// Apply visitor-module permissions and validation before invoking database rules.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { verifyFileAttachment } from '../files/attachments';
import { retryOnceOnDuplicate } from '../db/retry-on-duplicate';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { authorizeRequest } from '../permissions/authorize';
import {
  checkInPreApprovedVisitorPrivileged,
  checkInVisitorPrivileged,
  checkOutVisitorPrivileged,
  createVisitorEntryPrivileged,
  overrideVisitorPrivileged,
  validateVisitorCodePrivileged,
} from '../privileged';
import { visitorSettingsSchema } from '../modules';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import { requireIdentifiedGuard } from '../guards/operations';

const uuid = z.uuid();
const visitorEntrySchema = z
  .object({
    unitId: uuid,
    guardId: uuid.optional(),
    visitorName: z.string().trim().min(1).max(120),
    visitorPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,20}$/)
      .nullable(),
    purpose: z.enum(['guest', 'cab', 'service', 'official', 'other']),
    peopleCount: z.number().int().min(1).max(50),
    vehicleNo: z.string().trim().max(20).nullable(),
    photoPath: z.string().max(500).nullable(),
    clientRequestId: uuid,
  })
  .strict();
const preApprovalSchema = z
  .object({
    unitId: uuid,
    visitorName: z.string().trim().min(1).max(120),
    validFrom: z.iso.datetime({ offset: true }),
    validTo: z.iso.datetime({ offset: true }),
    vehicleNo: z.string().trim().max(20).nullable(),
  })
  .strict()
  .refine((value) => Date.parse(value.validTo) > Date.parse(value.validFrom), {
    path: ['validTo'],
    message: 'End time must be after start time.',
  });
const frequentVisitorSchema = z
  .object({
    unitId: uuid,
    visitorName: z.string().trim().min(1).max(120),
    vehicleNo: z.string().trim().max(20).nullable(),
  })
  .strict();
const frequentPreApprovalSchema = z
  .object({
    frequentVisitorId: uuid,
    validFrom: z.iso.datetime({ offset: true }),
    validTo: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((value) => Date.parse(value.validTo) > Date.parse(value.validFrom), {
    path: ['validTo'],
    message: 'End time must be after start time.',
  });
const codeSchema = z.string().regex(/^[0-9]{6}$/);

type VisitorRpcError = { code?: string };

export type VisitorBlacklistEntry = {
  id: string;
  phone: string;
  name: string | null;
  reason: string | null;
  active: boolean;
};

type VisitorEntry = {
  id: string;
  unit_id: string;
  visitor_name: string;
  visitor_phone: string | null;
  purpose: string;
  vehicle_no: string | null;
  people_count: number;
  source: string;
  status: string;
  created_at: string;
  respond_by: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  handled_by_guard_id: string;
  is_blacklisted: boolean;
  is_overstay: boolean;
};

export type VisitorPreApproval = {
  id: string;
  society_id: string;
  unit_id: string;
  visitor_name: string;
  valid_from: string;
  valid_to: string;
  vehicle_no: string | null;
  code: string;
  status: 'active' | 'used' | 'cancelled';
  used_at: string | null;
  is_expired?: boolean;
};

export type VisitorFrequentVisitor = {
  id: string;
  unit_id: string;
  visitor_name: string;
  vehicle_no: string | null;
  last_used_at: string | null;
};

export type VisitorUnitOption = {
  id: string;
  number: string;
  block: string | null;
};

async function getContext(
  permission:
    | 'visitor:list'
    | 'visitor:create'
    | 'visitor:decide'
    | 'visitor:override'
    | 'visitor:check_in'
    | 'visitor:preapproval:create'
    | 'visitor:preapproval:cancel'
    | 'visitor:frequent:manage'
    | 'visitor:settings:manage'
    | 'visitor:blacklist:read'
    | 'visitor:blacklist:manage',
  write = false,
) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { moduleKey: 'visitor', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    Object.fromEntries(
      result.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

function throwRpcError(label: string, error: unknown): never {
  const cause =
    error instanceof Error && error.cause && typeof error.cause === 'object'
      ? (error.cause as VisitorRpcError)
      : {};
  if (cause.code === '42501') throw new AppError('FORBIDDEN');
  if (cause.code === 'P0002') throw new AppError('NOT_FOUND');
  if (cause.code === '23505') {
    throw new AppError('CONFLICT', { reason: 'already_decided' });
  }
  if (cause.code === '23514') {
    throw new AppError('CONFLICT', { reason: 'invalid_state' });
  }
  if (cause.code === '22023') {
    throw new ValidationError({ form: 'Check the visitor details.' });
  }
  if (cause.code === '54000') {
    throw new AppError('CONFLICT', {
      reason: 'limit_reached',
      message: 'This unit already has 50 frequent visitors. Remove one first.',
    });
  }
  throw new Error(label, { cause: error });
}

async function rpc<T>(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  name: string,
  args: Record<string, unknown>,
  label: string,
): Promise<T> {
  try {
    return await invokeUntypedRpc<T>(context.db, name, args);
  } catch (error) {
    throwRpcError(label, error);
  }
}

async function privilegedRpc<T>(operation: Promise<T>, label: string) {
  try {
    return await operation;
  } catch (error) {
    throwRpcError(label, error);
  }
}

async function currentGuardId(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  suppliedGuardId?: string,
): Promise<string> {
  if (context.roles.includes('guard')) {
    return (await requireIdentifiedGuard()).id;
  }
  if (context.roles.includes('admin') && suppliedGuardId) {
    return suppliedGuardId;
  }
  throw new AppError('GUARD_NOT_IDENTIFIED');
}

export async function getVisitorSettings() {
  const { context, societyId } = await getContext('visitor:list');
  return readVisitorSettings(context, societyId);
}

export async function getVisitorRealtimeSocietyId() {
  const { societyId } = await getContext('visitor:list');
  return societyId;
}

export async function getVisitorAdminAccess() {
  const { context } = await getContext('visitor:list');
  if (!context.roles.some((role) => ['admin', 'committee'].includes(role))) {
    throw new AppError('FORBIDDEN');
  }
  return { canManage: context.roles.includes('admin') };
}

export async function requireVisitorResident() {
  const { context } = await getContext('visitor:list');
  if (!context.roles.includes('resident')) throw new AppError('FORBIDDEN');
}

export async function getVisitorSocietyTimezone() {
  const { context, societyId } = await getContext('visitor:list');
  const { data, error } = await context.db
    .from('societies')
    .select('timezone')
    .eq('id', societyId)
    .single();
  if (error) {
    throw new Error('Could not load the society time zone.', { cause: error });
  }
  return data.timezone;
}

async function readVisitorSettings(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  societyId: string,
) {
  const { data, error } = await context.db
    .from('module_configs')
    .select('settings')
    .eq('society_id', societyId)
    .eq('module_key', 'visitor')
    .maybeSingle();
  if (error) {
    throw new Error('Could not load visitor settings.', { cause: error });
  }
  if (!data) {
    throw new Error('Visitor settings were not initialized.');
  }
  const parsed = visitorSettingsSchema.parse(data.settings);
  return {
    approval_timeout_minutes: 3,
    overstay_hours: 12,
    photo_required: false,
    guard_override_allowed: false,
    phone_required: false,
    ...parsed,
  };
}

export async function listVisitorEntries(
  scope: 'all' | 'waiting' | 'inside' | 'today',
): Promise<VisitorEntry[]> {
  const { context, societyId } = await getContext('visitor:list');
  let unitIds: (string | null)[] = [null];
  if (
    context.roles.includes('resident') &&
    !context.roles.some((role) =>
      ['admin', 'committee', 'guard'].includes(role),
    )
  ) {
    const { data, error } = await context.db
      .from('unit_occupants')
      .select('unit_id')
      .eq('society_id', societyId)
      .eq('status', 'active');
    if (error) {
      throw new Error('Could not load occupied units.', { cause: error });
    }
    unitIds = [...new Set(data.map(({ unit_id }) => unit_id))];
  }
  const result = await Promise.all(
    unitIds.map((unitId) =>
      rpc<VisitorEntry[]>(
        context,
        'visitor_list_entries',
        { p_society_id: societyId, p_unit_id: unitId, p_scope: scope },
        'Could not load visitor entries.',
      ),
    ),
  );
  return result
    .flat()
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listVisitorUnits(
  scope: 'available' | 'own' = 'available',
): Promise<VisitorUnitOption[]> {
  const { context, societyId } = await getContext('visitor:list');
  let unitIds: string[] | null = null;
  if (scope === 'own' && !context.roles.includes('resident')) {
    throw new AppError('FORBIDDEN');
  }
  if (
    scope === 'own' ||
    (context.roles.includes('resident') &&
      !context.roles.some((role) =>
        ['admin', 'committee', 'guard'].includes(role),
      ))
  ) {
    const { data: occupants, error: occupantError } = await context.db
      .from('unit_occupants')
      .select('unit_id')
      .eq('society_id', societyId)
      .eq('status', 'active');
    if (occupantError) {
      throw new Error('Could not load occupied units.', {
        cause: occupantError,
      });
    }
    unitIds = [...new Set(occupants.map(({ unit_id }) => unit_id))];
    if (unitIds.length === 0) return [];
  }
  let unitsQuery = context.db
    .from('units')
    .select('id, number, block_id')
    .eq('society_id', societyId)
    .eq('active', true)
    .order('number');
  if (unitIds) unitsQuery = unitsQuery.in('id', unitIds);
  const { data: units, error: unitError } = await unitsQuery;
  if (unitError) {
    throw new Error('Could not load society units.', { cause: unitError });
  }
  const blockIds = [
    ...new Set(
      units
        .map(({ block_id }) => block_id)
        .filter((blockId): blockId is string => blockId !== null),
    ),
  ];
  if (blockIds.length === 0) {
    return units.map(({ id, number }) => ({ id, number, block: null }));
  }
  const { data: blocks, error: blockError } = await context.db
    .from('blocks')
    .select('id, name')
    .eq('society_id', societyId)
    .in('id', blockIds);
  if (blockError) {
    throw new Error('Could not load unit block names.', { cause: blockError });
  }
  const blockNames = new Map(blocks.map(({ id, name }) => [id, name]));
  return units.map(({ id, number, block_id }) => ({
    id,
    number,
    block: block_id ? (blockNames.get(block_id) ?? null) : null,
  }));
}

export async function createVisitorEntry(input: unknown, requestId: string) {
  const { context, societyId } = await getContext('visitor:create', true);
  const parsed = parseInput(visitorEntrySchema, input);
  const guardId = await currentGuardId(context, parsed.guardId);
  const settings = await readVisitorSettings(context, societyId);
  if (settings.photo_required && !parsed.photoPath) {
    throw new ValidationError({ photoPath: 'A visitor photo is required.' });
  }
  if (settings.phone_required && !parsed.visitorPhone) {
    throw new ValidationError({ visitorPhone: 'A phone number is required.' });
  }
  if (parsed.photoPath) {
    await verifyFileAttachment(context, {
      bucket: 'visitor-photos',
      contentTypes: ['image/jpeg', 'image/png'],
      maxBytes: 5 * 1024 * 1024,
      ownerPath: `${societyId}/${parsed.unitId}/visitors`,
      path: parsed.photoPath,
      societyId,
    });
  }
  const entry = await privilegedRpc(
    retryOnceOnDuplicate(() =>
      createVisitorEntryPrivileged<VisitorEntry>({
        p_actor_id: context.userId,
        p_society_id: societyId,
        p_unit_id: parsed.unitId,
        p_guard_id: guardId,
        p_visitor_name: parsed.visitorName,
        p_visitor_phone: parsed.visitorPhone,
        p_purpose: parsed.purpose,
        p_people_count: parsed.peopleCount,
        p_vehicle_no: parsed.vehicleNo,
        p_photo_path: parsed.photoPath,
        p_client_request_id: parsed.clientRequestId,
        p_request_id: requestId,
      }),
    ),
    'Could not create the visitor entry.',
  );
  const blacklisted = parsed.visitorPhone
    ? await rpc<boolean>(
        context,
        'visitor_blacklist_match',
        { p_society_id: societyId, p_phone: parsed.visitorPhone },
        'Could not check the visitor blacklist.',
      )
    : false;
  return { entry, blacklisted };
}

export async function decideVisitor(
  entryId: string,
  approve: boolean,
  requestId: string,
) {
  const { context } = await getContext('visitor:decide', true);
  const parsedId = uuid.safeParse(entryId);
  if (!parsedId.success)
    throw new ValidationError({ entryId: 'Choose a visitor.' });
  return rpc<VisitorEntry>(
    context,
    'visitor_decide',
    {
      p_entry_id: parsedId.data,
      p_approve: approve,
      p_request_id: requestId,
    },
    'Could not record the visitor decision.',
  );
}

export async function overrideVisitor(
  entryId: string,
  reason: string,
  requestId: string,
) {
  const { context } = await getContext('visitor:override', true);
  const guard = await requireIdentifiedGuard();
  const parsedId = uuid.safeParse(entryId);
  const parsedReason = z.string().trim().min(1).max(500).safeParse(reason);
  if (!parsedId.success || !parsedReason.success) {
    throw new ValidationError({
      form: 'Provide a visitor and an override reason.',
    });
  }
  return privilegedRpc(
    overrideVisitorPrivileged<VisitorEntry>({
      p_actor_id: context.userId,
      p_entry_id: parsedId.data,
      p_guard_id: guard.id,
      p_reason: parsedReason.data,
      p_request_id: requestId,
    }),
    'Could not override the visitor request.',
  );
}

export async function checkInVisitor(
  entryId: string,
  requestId: string,
  suppliedGuardId?: string,
) {
  const { context } = await getContext('visitor:check_in', true);
  const guardId = await currentGuardId(context, suppliedGuardId);
  return privilegedRpc(
    checkInVisitorPrivileged<VisitorEntry>({
      p_actor_id: context.userId,
      p_entry_id: entryId,
      p_guard_id: guardId,
      p_request_id: requestId,
    }),
    'Could not check in the visitor.',
  );
}

export async function checkOutVisitor(
  entryId: string,
  requestId: string,
  suppliedGuardId?: string,
) {
  const { context } = await getContext('visitor:check_in', true);
  const guardId = await currentGuardId(context, suppliedGuardId);
  return privilegedRpc(
    checkOutVisitorPrivileged<VisitorEntry>({
      p_actor_id: context.userId,
      p_entry_id: entryId,
      p_guard_id: guardId,
      p_request_id: requestId,
    }),
    'Could not check out the visitor.',
  );
}

export async function listVisitorPreApprovals(unitId: string) {
  const { context, societyId } = await getContext('visitor:list');
  const parsedUnit = uuid.nullable().safeParse(unitId || null);
  if (!parsedUnit.success)
    throw new ValidationError({ unitId: 'Choose a unit.' });
  const approvals = await rpc<VisitorPreApproval[]>(
    context,
    'visitor_list_pre_approvals',
    { p_society_id: societyId, p_unit_id: parsedUnit.data },
    'Could not load visitor pre-approvals.',
  );
  const now = Date.now();
  return approvals.map((approval) => ({
    ...approval,
    is_expired:
      approval.status === 'active' && Date.parse(approval.valid_to) <= now,
  }));
}

export async function createVisitorPreApproval(
  input: unknown,
  requestId: string,
) {
  const { context } = await getContext('visitor:preapproval:create', true);
  const parsed = parseInput(preApprovalSchema, input);
  return rpc<VisitorPreApproval>(
    context,
    'visitor_pre_approval_create',
    {
      p_unit_id: parsed.unitId,
      p_visitor_name: parsed.visitorName,
      p_valid_from: parsed.validFrom,
      p_valid_to: parsed.validTo,
      p_vehicle_no: parsed.vehicleNo,
      p_request_id: requestId,
    },
    'Could not create the visitor pre-approval.',
  );
}

export async function cancelVisitorPreApproval(
  approvalId: string,
  requestId: string,
) {
  const { context } = await getContext('visitor:preapproval:cancel', true);
  if (!uuid.safeParse(approvalId).success) {
    throw new ValidationError({ approvalId: 'Choose a pre-approval.' });
  }
  return rpc<void>(
    context,
    'visitor_pre_approval_cancel',
    { p_approval_id: approvalId, p_request_id: requestId },
    'Could not cancel the visitor pre-approval.',
  );
}

export async function listFrequentVisitors(
  unitId: string,
): Promise<VisitorFrequentVisitor[]> {
  const { context, societyId } = await getContext('visitor:frequent:manage');
  const parsedUnit = uuid.safeParse(unitId);
  if (!parsedUnit.success) {
    throw new ValidationError({ unitId: 'Choose a unit.' });
  }
  return rpc<VisitorFrequentVisitor[]>(
    context,
    'visitor_frequent_list',
    { p_society_id: societyId, p_unit_id: parsedUnit.data },
    'Could not load frequent visitors.',
  );
}

export async function saveFrequentVisitor(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'visitor:frequent:manage',
    true,
  );
  const parsed = parseInput(frequentVisitorSchema, input);
  return rpc<VisitorFrequentVisitor>(
    context,
    'visitor_frequent_save',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unitId,
      p_visitor_name: parsed.visitorName,
      p_vehicle_no: parsed.vehicleNo,
      p_request_id: requestId,
    },
    'Could not save the frequent visitor.',
  );
}

export async function removeFrequentVisitor(
  frequentVisitorId: string,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'visitor:frequent:manage',
    true,
  );
  if (!uuid.safeParse(frequentVisitorId).success) {
    throw new ValidationError({
      frequentVisitorId: 'Choose a frequent visitor.',
    });
  }
  return rpc<void>(
    context,
    'visitor_frequent_remove',
    {
      p_society_id: societyId,
      p_frequent_visitor_id: frequentVisitorId,
      p_request_id: requestId,
    },
    'Could not remove the frequent visitor.',
  );
}

export async function preApproveFrequentVisitor(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'visitor:frequent:manage',
    true,
  );
  authorizeRequest(context, {
    moduleKey: 'visitor',
    permission: 'visitor:preapproval:create',
    write: true,
  });
  const parsed = parseInput(frequentPreApprovalSchema, input);
  return rpc<VisitorPreApproval>(
    context,
    'visitor_frequent_pre_approve',
    {
      p_society_id: societyId,
      p_frequent_visitor_id: parsed.frequentVisitorId,
      p_valid_from: parsed.validFrom,
      p_valid_to: parsed.validTo,
      p_request_id: requestId,
    },
    'Could not pre-approve the frequent visitor.',
  );
}

export async function validateVisitorCode(code: string) {
  const { context, societyId } = await getContext('visitor:list');
  await currentGuardId(context);
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedCode.success) {
    return { reason: 'invalid' as const };
  }
  await enforceRateLimit(
    'visitorPreApprovalGuardFailures',
    context.userId,
    context.requestId,
  );
  await enforceRateLimit(
    'visitorPreApprovalSocietyFailures',
    societyId,
    context.requestId,
  );
  const result = await privilegedRpc(
    validateVisitorCodePrivileged<
      {
        reason: 'valid' | 'invalid' | 'expired' | 'already_used';
        visitor_name: string | null;
        unit_id: string | null;
        valid_from: string | null;
        valid_to: string | null;
        vehicle_no: string | null;
        approval_id: string | null;
      }[]
    >({
      p_actor_id: context.userId,
      p_society_id: societyId,
      p_code: parsedCode.data,
      p_request_id: context.requestId,
    }),
    'Could not validate the visitor code.',
  );
  const approval = result[0];
  if (!approval) return { reason: 'invalid' as const };
  if (approval.reason !== 'valid' || !approval.unit_id) return approval;

  const [
    { data: unit, error: unitError },
    { data: society, error: societyError },
  ] = await Promise.all([
    context.db
      .from('units')
      .select('number, block_id')
      .eq('id', approval.unit_id)
      .eq('society_id', societyId)
      .maybeSingle(),
    context.db
      .from('societies')
      .select('timezone')
      .eq('id', societyId)
      .single(),
  ]);
  if (unitError) {
    throw new Error('Could not load the pre-approval unit.', {
      cause: unitError,
    });
  }
  if (societyError) {
    throw new Error('Could not load the society time zone.', {
      cause: societyError,
    });
  }
  if (!unit) throw new AppError('NOT_FOUND');
  let unitLabel = unit.number;
  if (unit.block_id) {
    const { data: block, error: blockError } = await context.db
      .from('blocks')
      .select('name')
      .eq('id', unit.block_id)
      .eq('society_id', societyId)
      .single();
    if (blockError) {
      throw new Error('Could not load the pre-approval block.', {
        cause: blockError,
      });
    }
    unitLabel = `${block.name} · ${unit.number}`;
  }
  return { ...approval, unit_label: unitLabel, timezone: society.timezone };
}

export async function checkInPreApprovedVisitor(
  code: string,
  requestId: string,
) {
  const { context, societyId } = await getContext('visitor:check_in', true);
  const guard = await requireIdentifiedGuard();
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedCode.success)
    throw new ValidationError({ code: 'Enter a 6-digit code.' });
  await enforceRateLimit(
    'visitorPreApprovalGuardFailures',
    context.userId,
    context.requestId,
  );
  await enforceRateLimit(
    'visitorPreApprovalSocietyFailures',
    societyId,
    context.requestId,
  );
  return privilegedRpc(
    checkInPreApprovedVisitorPrivileged<VisitorEntry>({
      p_actor_id: context.userId,
      p_society_id: societyId,
      p_code: parsedCode.data,
      p_guard_id: guard.id,
      p_request_id: requestId,
    }),
    'Could not check in the pre-approved visitor.',
  );
}

export async function listVisitorBlacklist(): Promise<VisitorBlacklistEntry[]> {
  const { context, societyId } = await getContext('visitor:blacklist:read');
  return rpc<VisitorBlacklistEntry[]>(
    context,
    'visitor_list_blacklist',
    { p_society_id: societyId },
    'Could not load the visitor blacklist.',
  );
}

export async function addVisitorBlacklistEntry(
  input: { phone: string; name?: string; reason?: string },
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'visitor:blacklist:manage',
    true,
  );
  const parsed = z
    .object({
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9]{7,20}$/),
      name: z.string().trim().max(120).optional(),
      reason: z.string().trim().max(500).optional(),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ form: 'Check the blacklist details.' });
  }
  return rpc<string>(
    context,
    'visitor_blacklist_add',
    {
      p_society_id: societyId,
      p_phone: parsed.data.phone,
      p_name: parsed.data.name ?? null,
      p_reason: parsed.data.reason ?? null,
      p_request_id: requestId,
    },
    'Could not add the blacklist entry.',
  );
}

export async function removeVisitorBlacklistEntry(
  blacklistId: string,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'visitor:blacklist:manage',
    true,
  );
  if (!uuid.safeParse(blacklistId).success) {
    throw new ValidationError({ blacklistId: 'Choose a blacklist entry.' });
  }
  return rpc<void>(
    context,
    'visitor_blacklist_remove',
    {
      p_society_id: societyId,
      p_blacklist_id: blacklistId,
      p_request_id: requestId,
    },
    'Could not remove the blacklist entry.',
  );
}

export async function updateVisitorSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'visitor:settings:manage',
    true,
  );
  const parsed = visitorSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({
      form: 'Check the visitor module settings.',
    });
  }
  return rpc<Record<string, unknown>>(
    context,
    'visitor_update_settings',
    {
      p_society_id: societyId,
      p_settings: parsed.data,
      p_request_id: requestId,
    },
    'Could not save visitor settings.',
  );
}
