// Validate P57 public enquiries, platform contact settings and developer-only management.
import 'server-only';
import { z } from 'zod';
import { createUserSupabaseClient } from '../db/server-client';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { AppError, ValidationError, createRequestId } from '../errors';
import { enforceRateLimit } from '../rate-limit';
import { sendTransactionalEmail } from '../privileged';
import { requireDeveloperContext } from '../developer/console';

const publicSettingsSchema = z.object({
  contact_email: z.email().max(254).nullable(),
  enquiry_hourly_limit: z.number().int().min(1).max(100),
});

const enquiryInputSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    societyName: z
      .string()
      .trim()
      .max(160)
      .transform((value) => value || null),
    city: z
      .string()
      .trim()
      .max(120)
      .transform((value) => value || null),
    flatCount: z
      .string()
      .trim()
      .transform((value) => (value ? Number(value) : null))
      .pipe(z.number().int().min(1).max(100000).nullable()),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => value || null)
      .pipe(z.email().max(254).nullable()),
    phone: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(
        z
          .string()
          .regex(/^\+?[0-9]{10,15}$/)
          .nullable(),
      ),
    message: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || null),
    trap: z.string().max(500).optional().default(''),
  })
  .strict()
  .refine(({ email, phone }) => email !== null || phone !== null, {
    message: 'Enter an email address or phone number.',
    path: ['email'],
  });

const developerSettingsInputSchema = z
  .object({
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => value || null)
      .pipe(z.email().max(254).nullable()),
    enquiryHourlyLimit: z.coerce.number().int().min(1).max(100),
  })
  .strict();

const enquiryRowSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  society_name: z.string().nullable(),
  city: z.string().nullable(),
  flat_count: z.number().int().nullable(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(['new', 'handled']),
  submitted_at: z.iso.datetime({ offset: true }),
  handled_at: z.iso.datetime({ offset: true }).nullable(),
});

const developerSettingsSchema = z.object({
  contact_email: z.email().nullable(),
  enquiry_hourly_limit: z.number().int().min(1).max(100),
  updated_at: z.iso.datetime({ offset: true }),
  updated_by: z.uuid().nullable(),
});

function fieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    error.issues.map((issue) => [
      String(issue.path[0] ?? 'form'),
      issue.message,
    ]),
  );
}

async function publicClient() {
  return (await createUserSupabaseClient()).client;
}

export async function getPublicWebsiteSettings() {
  const result = await invokeUntypedRpc<
    Array<z.infer<typeof publicSettingsSchema>>
  >(await publicClient(), 'website_public_settings_get', {});
  const parsed = z.array(publicSettingsSchema).length(1).safeParse(result);
  if (!parsed.success) {
    throw new Error('The public website settings returned an invalid result.');
  }
  return {
    contactEmail: parsed.data[0]!.contact_email,
    enquiryHourlyLimit: parsed.data[0]!.enquiry_hourly_limit,
  };
}

export async function submitWebsiteEnquiry(
  input: unknown,
  ipAddress: string,
  requestId = createRequestId(),
): Promise<void> {
  const parsed = enquiryInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }
  if (parsed.data.trap) return;

  const settings = await getPublicWebsiteSettings();
  await enforceRateLimit(
    'publicWebsiteEnquiryIpHourly',
    ipAddress,
    requestId,
    settings.enquiryHourlyLimit,
  );

  const client = await publicClient();
  await invokeUntypedRpc<string>(client, 'website_enquiry_create', {
    p_request_id: requestId,
    p_full_name: parsed.data.fullName,
    p_society_name: parsed.data.societyName,
    p_city: parsed.data.city,
    p_flat_count: parsed.data.flatCount,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_message: parsed.data.message,
  });

  if (!settings.contactEmail) return;
  const result = await sendTransactionalEmail({
    to: { email: settings.contactEmail, name: 'Homeish team' },
    subject: `Homeish enquiry from ${parsed.data.fullName}`,
    textContent: [
      `Name: ${parsed.data.fullName}`,
      `Society: ${parsed.data.societyName ?? 'Not supplied'}`,
      `City: ${parsed.data.city ?? 'Not supplied'}`,
      `Number of flats: ${parsed.data.flatCount ?? 'Not supplied'}`,
      `Email: ${parsed.data.email ?? 'Not supplied'}`,
      `Phone: ${parsed.data.phone ?? 'Not supplied'}`,
      '',
      parsed.data.message ?? 'No message supplied.',
    ].join('\n'),
  });
  if (!result.sent) {
    console.warn('Homeish enquiry email was not delivered.', {
      reason: result.reason,
      requestId,
    });
  }
}

export async function getDeveloperWebsiteSettings() {
  const context = await requireDeveloperContext();
  const result = await invokeUntypedRpc<
    Array<z.infer<typeof developerSettingsSchema>>
  >(context.db, 'developer_website_settings_get', {});
  const parsed = z.array(developerSettingsSchema).length(1).safeParse(result);
  if (!parsed.success) {
    throw new Error(
      'The developer website settings returned an invalid result.',
    );
  }
  return {
    contactEmail: parsed.data[0]!.contact_email,
    enquiryHourlyLimit: parsed.data[0]!.enquiry_hourly_limit,
    updatedAt: parsed.data[0]!.updated_at,
    updatedBy: parsed.data[0]!.updated_by,
  };
}

export async function saveDeveloperWebsiteSettings(input: unknown) {
  const parsed = developerSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }
  const context = await requireDeveloperContext();
  await invokeUntypedRpc(context.db, 'developer_website_settings_save', {
    p_contact_email: parsed.data.contactEmail,
    p_enquiry_hourly_limit: parsed.data.enquiryHourlyLimit,
  });
}

export async function getDeveloperWebsiteEnquiries() {
  const context = await requireDeveloperContext();
  const result = await invokeUntypedRpc<unknown[]>(
    context.db,
    'developer_website_enquiries_get',
    {},
  );
  const parsed = z.array(enquiryRowSchema).safeParse(result);
  if (!parsed.success) {
    throw new Error('The website enquiries returned an invalid result.');
  }
  return parsed.data;
}

export async function handleDeveloperWebsiteEnquiry(input: unknown) {
  const enquiryId = z.uuid().safeParse(input);
  if (!enquiryId.success) {
    throw new ValidationError({ enquiryId: 'Choose a valid enquiry.' });
  }
  const context = await requireDeveloperContext();
  try {
    await invokeUntypedRpc(context.db, 'developer_website_enquiry_handle', {
      p_enquiry_id: enquiryId.data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      typeof error.cause === 'object' &&
      error.cause !== null &&
      'code' in error.cause &&
      error.cause.code === 'P0002'
    ) {
      throw new AppError('NOT_FOUND', {
        message: 'This enquiry is unavailable.',
      });
    }
    throw error;
  }
}

export async function deleteDeveloperWebsiteEnquiry(input: unknown) {
  const enquiryId = z.uuid().safeParse(input);
  if (!enquiryId.success) {
    throw new ValidationError({ enquiryId: 'Choose a valid enquiry.' });
  }
  const context = await requireDeveloperContext();
  await invokeUntypedRpc(context.db, 'developer_website_enquiry_delete', {
    p_enquiry_id: enquiryId.data,
  });
}
