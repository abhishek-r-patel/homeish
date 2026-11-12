// Validate and authorize developer-console mutations at the server boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import {
  AppError,
  ERROR_MESSAGES,
  ValidationError,
  createRequestId,
  requestIdFromHeaders,
} from '@/core/errors';
import {
  createFirstAdmin,
  createSociety,
  eraseUser,
  firstAdminSchema,
  requireDeveloperContext,
  setErrorStatus,
  setSocietyStatus,
  societyInputSchema,
  societyStatusSchema,
  toggleModule,
  updateModuleSettings,
  updateSociety,
  updateSocietyLogo,
  type DeveloperActionResult,
} from '@/core/developer/console';
import { logUnexpectedError } from '@/core/logging/error-logger';
import { MODULE_KEYS } from '@/core/modules';

async function runDeveloperAction(
  route: string,
  operation: (requestId: string) => Promise<DeveloperActionResult>,
): Promise<DeveloperActionResult> {
  let requestId = createRequestId();
  try {
    const requestHeaders = await headers();
    requestId = requestIdFromHeaders(requestHeaders);
    return await operation(requestId);
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        ...(error.referenceId ? { referenceId: error.referenceId } : {}),
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      };
    }

    const referenceId = await logUnexpectedError(error, {
      requestId,
      route,
      source: 'server',
    });
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      referenceId,
    };
  }
}

function parseValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const fieldErrors = Object.fromEntries(
    parsed.error.issues.map((issue) => [
      String(issue.path[0] ?? 'form'),
      issue.message,
    ]),
  );
  throw new ValidationError(fieldErrors);
}

function parseForm<T>(
  schema: z.ZodType<T>,
  formData: FormData,
  excludedFields: readonly string[] = [],
): T {
  const values = Object.fromEntries(
    [...formData.entries()].filter(
      ([name]) =>
        !name.startsWith('$ACTION_') && !excludedFields.includes(name),
    ),
  );
  return parseValue(schema, values);
}

const societyIdSchema = z.uuid();
const societyLogoPathSchema = z.string().max(500);
const societyStatusInputSchema = z
  .object({ societyId: societyIdSchema, status: societyStatusSchema })
  .strict();
const toggleSchema = z
  .object({
    societyId: societyIdSchema,
    moduleKey: z.enum(MODULE_KEYS),
    enabled: z.enum(['true', 'false']).transform((value) => value === 'true'),
  })
  .strict();
const settingsSchema = z
  .object({
    societyId: societyIdSchema,
    moduleKey: z.enum(MODULE_KEYS),
    settings: z.string().max(8000),
  })
  .strict();
const errorStatusSchema = z
  .object({
    errorId: societyIdSchema,
    status: z.enum(['resolved', 'ignored']),
    note: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null),
  })
  .strict();
const userErasureSchema = z
  .object({ userId: z.uuid(), confirmation: z.literal('ERASE') })
  .strict();

export async function createSocietyAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction('developer.societies.create', async (requestId) => {
    const context = await requireDeveloperContext(requestId);
    const input = parseForm(societyInputSchema, formData);
    const societyId = await createSociety(context, input);
    revalidatePath('/developer');
    return { ok: true, message: 'Society created.', societyId };
  });
}

export async function updateSocietyAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction('developer.societies.update', async (requestId) => {
    const context = await requireDeveloperContext(requestId);
    const societyId = parseValue(societyIdSchema, formData.get('societyId'));
    const input = parseForm(societyInputSchema, formData, [
      'societyId',
      'logoPath',
    ]);
    const logoPath = parseValue(
      societyLogoPathSchema,
      formData.get('logoPath') ?? '',
    );
    await updateSociety(context, societyId, input);
    await updateSocietyLogo(
      context,
      societyId,
      logoPath === '' ? null : logoPath,
    );
    revalidatePath(`/developer/societies/${societyId}`);
    revalidatePath('/developer');
    return { ok: true, message: 'Society details saved.' };
  });
}

export async function setSocietyStatusAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction(
    'developer.societies.setStatus',
    async (requestId) => {
      const context = await requireDeveloperContext(requestId);
      const { societyId, status } = parseForm(
        societyStatusInputSchema,
        formData,
      );
      await setSocietyStatus(context, societyId, status);
      revalidatePath(`/developer/societies/${societyId}`);
      revalidatePath('/developer');
      return { ok: true, message: 'Society status updated.' };
    },
  );
}

export async function toggleModuleAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction('developer.modules.toggle', async (requestId) => {
    const context = await requireDeveloperContext(requestId);
    const input = parseForm(toggleSchema, formData);
    await toggleModule(
      context,
      input.societyId,
      input.moduleKey,
      input.enabled,
    );
    revalidatePath('/developer/modules');
    return { ok: true, message: 'Module setting saved.' };
  });
}

export async function updateModuleSettingsAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction(
    'developer.modules.updateSettings',
    async (requestId) => {
      const context = await requireDeveloperContext(requestId);
      const input = parseForm(settingsSchema, formData);
      let settings: unknown;
      try {
        settings = JSON.parse(input.settings);
      } catch {
        throw new ValidationError({
          settings: 'Enter valid JSON settings.',
        });
      }
      try {
        await updateModuleSettings(
          context,
          input.societyId,
          input.moduleKey,
          settings,
        );
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError({
            settings: error.issues[0]?.message ?? 'Settings are not valid.',
          });
        }
        throw error;
      }
      revalidatePath('/developer/modules');
      return { ok: true, message: 'Module settings saved.' };
    },
  );
}

export async function createFirstAdminAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction(
    'developer.members.createFirstAdmin',
    async (requestId) => {
      const context = await requireDeveloperContext(requestId);
      const societyId = parseValue(societyIdSchema, formData.get('societyId'));
      const input = parseForm(firstAdminSchema, formData, ['societyId']);
      await createFirstAdmin(context, societyId, input.email);
      revalidatePath(`/developer/societies/${societyId}`);
      return { ok: true, message: 'First admin invitation created.' };
    },
  );
}

export async function setErrorStatusAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction('developer.errors.update', async (requestId) => {
    const context = await requireDeveloperContext(requestId);
    const input = parseForm(errorStatusSchema, formData);
    await setErrorStatus(context, input.errorId, input.status, input.note);
    revalidatePath('/developer/errors');
    revalidatePath(`/developer/errors/${input.errorId}`);
    return { ok: true, message: 'Error status updated.' };
  });
}

export async function eraseUserAction(
  formData: FormData,
): Promise<DeveloperActionResult> {
  return runDeveloperAction('developer.users.erase', async (requestId) => {
    const context = await requireDeveloperContext(requestId);
    const { userId } = parseForm(userErasureSchema, formData);
    await eraseUser(context, userId);
    revalidatePath('/developer');
    revalidatePath('/developer/audit');
    revalidatePath('/developer/errors');
    return {
      ok: true,
      message: 'Auth account deleted; historical records remain anonymized.',
    };
  });
}
