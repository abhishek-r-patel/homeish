// Tenant-scoped membership, occupancy, household and profile operations.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { createUserSupabaseClient } from '../db/server-client';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { MAX_RESIDENT_CSV_BYTES, parseResidentsCsv } from './residents-csv';

const roleSchema = z.enum([
  'admin',
  'committee',
  'guard',
  'hk_supervisor',
  'resident',
]);

const invitationSchema = z
  .object({
    email: z.email().max(254),
    roles: z.array(roleSchema).min(1),
    unitId: z.uuid(),
    relationship: z.enum(['owner', 'tenant', 'family']),
    isPrimary: z.boolean(),
    isApprover: z.boolean(),
  })
  .strict()
  .refine((value) => !value.isPrimary || value.relationship !== 'family', {
    message: 'A family occupant cannot be the primary resident.',
    path: ['isPrimary'],
  })
  .refine((value) => value.roles.includes('resident'), {
    message: 'An invitation to a unit must include the resident role.',
    path: ['roles'],
  });

const memberRolesSchema = z
  .object({
    membershipId: z.uuid(),
    roles: z.array(roleSchema).min(1),
  })
  .strict();

const membershipIdSchema = z.object({ membershipId: z.uuid() }).strict();
const registrationDecisionSchema = z
  .object({
    membershipId: z.uuid(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();
const formCheckboxSchema = z.preprocess((value) => value === 'on', z.boolean());
const occupancySchema = z
  .object({
    unitId: z.uuid(),
    membershipId: z.uuid(),
    relationship: z.enum(['owner', 'tenant', 'family']),
    isPrimary: formCheckboxSchema,
    isApprover: formCheckboxSchema,
    startedAt: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.iso.date().optional(),
    ),
  })
  .strict()
  .refine((value) => !value.isPrimary || value.relationship !== 'family', {
    message: 'A family occupant cannot be the primary resident.',
    path: ['isPrimary'],
  });

const moveOccupancySchema = z
  .object({ occupantId: z.uuid(), unitId: z.uuid() })
  .strict();

const endOccupancySchema = z
  .object({
    occupantId: z.uuid(),
    endedAt: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.iso.date().optional(),
    ),
  })
  .strict();

const approverSchema = z
  .object({ occupantId: z.uuid(), isApprover: z.boolean() })
  .strict();

const profileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z
      .string()
      .trim()
      .transform((value) => value || null)
      .refine((value) => value === null || /^\+?[0-9]{10,15}$/.test(value), {
        message: 'Enter a phone number with 10 to 15 digits.',
      }),
    fontPreference: z.enum(['manrope_sora', 'device_default']),
  })
  .strict();

export type SocietyMember = {
  membership_id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  phone_masked: string | null;
  roles: string[];
  status: string;
  occupant_id: string | null;
  unit_id: string | null;
  unit_number: string | null;
  block_name: string | null;
  relationship: string | null;
  is_primary: boolean | null;
  is_approver: boolean | null;
  occupant_status: string | null;
};

async function getMembershipContext(
  permission: 'membership:read' | 'membership:manage',
  write = false,
) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { moduleKey: 'core', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

async function getHouseholdContext(
  permission: 'household:read' | 'household:manage',
  write = false,
) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { moduleKey: 'core', permission, write });
  return context;
}

function parseForm<T>(schema: z.ZodType<T>, formData: FormData): T {
  const values = Object.fromEntries(
    [...formData.entries()].filter(([name]) => !name.startsWith('$ACTION_')),
  );
  const parsed = schema.safeParse(values);
  if (parsed.success) return parsed.data;
  throw new ValidationError(
    Object.fromEntries(
      parsed.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

function parseRoles(value: FormDataEntryValue[]): z.infer<typeof roleSchema>[] {
  const parsed = z.array(roleSchema).min(1).safeParse(value);
  if (parsed.success) return [...new Set(parsed.data)];
  throw new ValidationError({ roles: 'Choose at least one valid role.' });
}

async function loadResidentImportContext() {
  const { context, societyId } =
    await getMembershipContext('membership:manage');
  const [unitsResult, blocksResult, membersResult] = await Promise.all([
    context.db
      .from('units')
      .select('id, number, block_id')
      .eq('society_id', societyId)
      .eq('active', true),
    context.db
      .from('blocks')
      .select('id, name')
      .eq('society_id', societyId)
      .eq('active', true),
    context.db.rpc('list_society_members', { p_society_id: societyId }),
  ]);
  if (unitsResult.error) {
    throw new Error('Could not load active units for the import.', {
      cause: unitsResult.error,
    });
  }
  if (blocksResult.error) {
    throw new Error('Could not load active blocks for the import.', {
      cause: blocksResult.error,
    });
  }
  if (membersResult.error) {
    raiseRpcError(
      'Could not check existing member invitations.',
      membersResult.error,
    );
  }
  if (!membersResult.data) {
    throw new Error('Member import validation returned no result.');
  }
  return {
    context,
    societyId,
    units: unitsResult.data,
    blocks: blocksResult.data,
    existingEmails: membersResult.data.map(({ email }) => email),
  };
}

function raiseRpcError(
  label: string,
  error: { code?: string; message: string } | null,
): void {
  if (!error) return;
  if (error.code === '42501') throw new AppError('FORBIDDEN');
  if (error.code === 'P0002') throw new AppError('NOT_FOUND');
  if (error.code === '23505' || error.code === '23514') {
    throw new AppError('CONFLICT', {
      reason: 'invalid_state',
      message: 'This change conflicts with the current society records.',
    });
  }
  if (error.code === '22023') {
    throw new ValidationError({ form: error.message });
  }
  throw new Error(label, { cause: error });
}

export async function listSocietyMembers(): Promise<{
  canManage: boolean;
  members: readonly SocietyMember[];
  units: readonly {
    id: string;
    number: string;
    block_id: string | null;
  }[];
}> {
  const { context, societyId } = await getMembershipContext('membership:read');
  const [membersResult, unitsResult] = await Promise.all([
    context.db.rpc('list_society_members', { p_society_id: societyId }),
    context.db
      .from('units')
      .select('id, number, block_id')
      .eq('society_id', societyId)
      .eq('active', true)
      .order('number'),
  ]);
  if (membersResult.error) {
    raiseRpcError('Could not load society members.', membersResult.error);
  }
  if (!membersResult.data) {
    throw new Error('Society member query returned no result.');
  }
  if (unitsResult.error) {
    throw new Error('Could not load society units.', {
      cause: unitsResult.error,
    });
  }
  return {
    canManage: context.roles.includes('admin'),
    members: membersResult.data,
    units: unitsResult.data,
  };
}

export async function inviteResident(formData: FormData, requestId: string) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = invitationSchema.safeParse({
    email: formData.get('email'),
    roles: parseRoles(formData.getAll('roles')),
    unitId: formData.get('unitId'),
    relationship: formData.get('relationship'),
    isPrimary: formData.get('isPrimary') === 'on',
    isApprover: formData.get('isApprover') === 'on',
  });
  if (!parsed.success) {
    throw new ValidationError(
      Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0] ?? 'form'),
          issue.message,
        ]),
      ),
    );
  }
  const { error } = await context.db.rpc('create_member_invitation', {
    p_society_id: societyId,
    p_email: parsed.data.email,
    p_roles: parsed.data.roles,
    p_unit_id: parsed.data.unitId,
    p_relationship: parsed.data.relationship,
    p_is_primary: parsed.data.isPrimary,
    p_is_approver: parsed.data.isApprover,
    p_request_id: requestId,
  });
  raiseRpcError('Could not invite the resident.', error);
}

export async function previewResidentsImport(csv: string) {
  if (typeof csv !== 'string') {
    throw new ValidationError({ file: 'Choose a CSV file to preview.' });
  }
  if (new TextEncoder().encode(csv).byteLength > MAX_RESIDENT_CSV_BYTES) {
    return parseResidentsCsv(csv, [], [], []);
  }
  const { units, blocks, existingEmails } = await loadResidentImportContext();
  return parseResidentsCsv(csv, units, blocks, existingEmails);
}

export async function confirmResidentsImport(
  csv: string,
  requestId: string,
): Promise<string> {
  if (typeof csv !== 'string') {
    throw new ValidationError({ file: 'Choose a CSV file to import.' });
  }
  const { context, societyId, units, blocks, existingEmails } =
    await loadResidentImportContext();
  const preview = parseResidentsCsv(csv, units, blocks, existingEmails);
  if (preview.issues.length || !preview.rows.length) {
    throw new ValidationError({
      file:
        preview.issues[0]?.message ??
        'The CSV does not contain any valid resident rows.',
    });
  }
  const { data, error } = await context.db.rpc('create_resident_import_job', {
    p_society_id: societyId,
    p_rows: preview.rows,
    p_request_id: requestId,
  });
  raiseRpcError('Could not import residents.', error);
  if (!data)
    throw new Error('Resident import did not return a job identifier.');
  return data;
}

export async function changeMemberRoles(formData: FormData, requestId: string) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = memberRolesSchema.safeParse({
    membershipId: formData.get('membershipId'),
    roles: parseRoles(formData.getAll('roles')),
  });
  if (!parsed.success) {
    throw new ValidationError({
      form: parsed.error.issues[0]?.message ?? 'Choose valid roles.',
    });
  }
  const { error } = await context.db.rpc('change_member_roles', {
    p_society_id: societyId,
    p_membership_id: parsed.data.membershipId,
    p_roles: parsed.data.roles,
    p_request_id: requestId,
  });
  raiseRpcError('Could not update member roles.', error);
}

export async function deactivateMember(formData: FormData, requestId: string) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = parseForm(membershipIdSchema, formData);
  const { error } = await context.db.rpc('deactivate_member', {
    p_society_id: societyId,
    p_membership_id: parsed.membershipId,
    p_request_id: requestId,
  });
  raiseRpcError('Could not deactivate this member.', error);
}

async function decideSocietyRegistration(
  formData: FormData,
  requestId: string,
  decision: 'approve' | 'reject',
) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = parseForm(registrationDecisionSchema, formData);
  try {
    await invokeUntypedRpc<void>(
      context.db,
      decision === 'approve'
        ? 'approve_society_registration'
        : 'reject_society_registration',
      {
        p_society_id: societyId,
        p_membership_id: parsed.membershipId,
        ...(decision === 'reject' ? { p_reason: parsed.reason ?? null } : {}),
        p_request_id: requestId,
      },
    );
  } catch (error) {
    const cause =
      error instanceof Error && typeof error.cause === 'object' && error.cause
        ? (error.cause as { code?: string })
        : null;
    if (cause?.code === '42501') throw new AppError('FORBIDDEN');
    if (cause?.code === 'P0002') throw new AppError('NOT_FOUND');
    if (cause?.code === '23505' || cause?.code === '23514') {
      throw new AppError('CONFLICT', {
        reason: 'invalid_state',
        message:
          'This registration cannot be approved while the unit has another primary resident.',
      });
    }
    if (cause?.code === '22023') {
      throw new ValidationError({
        reason: 'Enter a reason of 200 characters or fewer.',
      });
    }
    throw new Error('Could not update the registration decision.', {
      cause: error,
    });
  }
  await sendNotificationPushesForRequest(requestId);
}

export async function approveSocietyRegistration(
  formData: FormData,
  requestId: string,
) {
  await decideSocietyRegistration(formData, requestId, 'approve');
}

export async function rejectSocietyRegistration(
  formData: FormData,
  requestId: string,
) {
  await decideSocietyRegistration(formData, requestId, 'reject');
}

export async function assignOccupant(formData: FormData, requestId: string) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = parseForm(occupancySchema, formData);
  const { error } = await context.db.rpc('assign_unit_occupant', {
    p_society_id: societyId,
    p_unit_id: parsed.unitId,
    p_membership_id: parsed.membershipId,
    p_relationship: parsed.relationship,
    p_is_primary: parsed.isPrimary,
    p_is_approver: parsed.isApprover,
    p_started_at: parsed.startedAt ?? new Date().toISOString().slice(0, 10),
    p_request_id: requestId,
  });
  raiseRpcError('Could not assign this resident to the unit.', error);
}

export async function moveOccupant(formData: FormData, requestId: string) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = parseForm(moveOccupancySchema, formData);
  const { error } = await context.db.rpc('move_unit_occupant', {
    p_society_id: societyId,
    p_occupant_id: parsed.occupantId,
    p_target_unit_id: parsed.unitId,
    p_request_id: requestId,
  });
  raiseRpcError('Could not move this resident.', error);
}

export async function endOccupancy(formData: FormData, requestId: string) {
  const { context, societyId } = await getMembershipContext(
    'membership:manage',
    true,
  );
  const parsed = parseForm(endOccupancySchema, formData);
  const { error } = await context.db.rpc('end_unit_occupancy', {
    p_society_id: societyId,
    p_occupant_id: parsed.occupantId,
    p_ended_at: parsed.endedAt ?? new Date().toISOString().slice(0, 10),
    p_request_id: requestId,
  });
  raiseRpcError('Could not end this occupancy.', error);
}

export async function getHouseholdMembers() {
  const context = await getHouseholdContext('household:read');
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const { data: occupancy, error: occupancyError } = await context.db
    .from('unit_occupants')
    .select('unit_id')
    .eq('society_id', context.societyId)
    .eq('status', 'active');
  if (occupancyError) {
    throw new Error('Could not load the current household.', {
      cause: occupancyError,
    });
  }
  const unitIds = [...new Set(occupancy.map(({ unit_id }) => unit_id))];
  if (!unitIds.length) return { households: [] };
  const { data: units, error: unitsError } = await context.db
    .from('units')
    .select('id, number, block_id')
    .in('id', unitIds);
  if (unitsError) {
    throw new Error('Could not load household unit details.', {
      cause: unitsError,
    });
  }
  const blockIds = [
    ...new Set(
      units
        .map(({ block_id }) => block_id)
        .filter((blockId): blockId is string => blockId !== null),
    ),
  ];
  const { data: blocks, error: blocksError } = blockIds.length
    ? await context.db.from('blocks').select('id, name').in('id', blockIds)
    : { data: [], error: null };
  if (blocksError) {
    throw new Error('Could not load household block details.', {
      cause: blocksError,
    });
  }
  const blockNames = new Map(blocks.map(({ id, name }) => [id, name]));
  const unitLabels = new Map(
    units.map((unit) => [
      unit.id,
      `${unit.block_id ? `${blockNames.get(unit.block_id)} · ` : ''}${unit.number}`,
    ]),
  );
  const households = await Promise.all(
    unitIds.map(async (unitId) => {
      const { data, error } = await context.db.rpc('list_household_members', {
        p_unit_id: unitId,
      });
      if (error) raiseRpcError('Could not load household members.', error);
      if (!data) {
        throw new Error('Household member query returned no result.');
      }
      return {
        unitId,
        label: unitLabels.get(unitId) ?? 'Household',
        members: data,
      };
    }),
  );
  return { households };
}

export async function setHouseholdApprover(
  formData: FormData,
  requestId: string,
) {
  const context = await getHouseholdContext('household:manage', true);
  const parsed = approverSchema.safeParse({
    occupantId: formData.get('occupantId'),
    isApprover: formData.get('isApprover') === 'true',
  });
  if (!parsed.success) {
    throw new ValidationError({ form: 'Choose a valid household member.' });
  }
  const { error } = await context.db.rpc('set_household_approver', {
    p_occupant_id: parsed.data.occupantId,
    p_is_approver: parsed.data.isApprover,
    p_request_id: requestId,
  });
  raiseRpcError('Could not update household approver access.', error);
}

export async function getProfile() {
  const context = await buildRequestContext(createRequestId());
  const { data, error } = await context.db
    .from('profiles')
    .select('email, full_name, phone, font_preference')
    .eq('id', context.userId)
    .single();
  if (error) throw new Error('Could not load your profile.', { cause: error });
  return data;
}

export async function getSavedFontPreference(): Promise<
  'manrope_sora' | 'device_default' | null
> {
  const { client } = await createUserSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) {
    if (
      authError.name === 'AuthSessionMissingError' ||
      authError.status === 401
    ) {
      return null;
    }
    throw new Error('Could not verify the current account.', {
      cause: authError,
    });
  }
  if (!authData.user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('font_preference')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (error) {
    throw new Error('Could not load the saved font preference.', {
      cause: error,
    });
  }
  if (!data) return null;
  if (
    data.font_preference !== 'manrope_sora' &&
    data.font_preference !== 'device_default'
  ) {
    throw new Error('The saved font preference is unsupported.');
  }
  return data.font_preference;
}

export async function updateProfile(formData: FormData) {
  const context = await buildRequestContext(createRequestId());
  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    fontPreference: formData.get('fontPreference'),
  });
  if (!parsed.success) {
    throw new ValidationError(
      Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0] ?? 'form'),
          issue.message,
        ]),
      ),
    );
  }
  const { error } = await context.db
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      font_preference: parsed.data.fontPreference,
    })
    .eq('id', context.userId);
  if (error) {
    if (error.code === '23514') {
      throw new ValidationError({ phone: 'Enter a valid phone number.' });
    }
    throw new Error('Could not update your profile.', { cause: error });
  }
}
