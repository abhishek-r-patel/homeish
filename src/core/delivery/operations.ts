// Apply delivery-module permissions and validation before invoking database rules.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { retryOnceOnDuplicate } from '../db/retry-on-duplicate';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { verifyFileAttachment } from '../files/attachments';
import {
  collectDeliveryAsGuardPrivileged,
  createDeliveryEntryPrivileged,
  overrideDeliveryPrivileged,
} from '../privileged';
import { deliverySettingsSchema } from '../modules';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { requireIdentifiedGuard } from '../guards/operations';

const uuid = z.uuid();
const deliveryInputSchema = z
  .object({
    unitId: uuid,
    guardId: uuid.optional(),
    company: z.string().trim().min(1).max(60),
    deliveryPerson: z.string().trim().max(120).nullable(),
    deliveryType: z.enum(['food', 'parcel', 'grocery', 'other']),
    photoPath: z.string().max(500).nullable(),
    clientRequestId: uuid,
  })
  .strict();
const decisionSchema = z.enum(['allowed', 'left_at_gate', 'denied']);
const overrideDecisionSchema = z.enum([
  'allowed',
  'left_at_gate',
  'denied',
  'closed',
]);
const preferenceSchema = z.enum([
  'ask',
  'always_allow',
  'always_leave_at_gate',
]);
const preAnnounceSchema = z
  .object({
    unitId: uuid,
    platform: z.string().trim().min(1).max(60),
    expectedFrom: z.iso.datetime({ offset: true }),
    expectedTo: z.iso.datetime({ offset: true }),
    clientRequestId: uuid,
  })
  .strict()
  .refine(
    ({ expectedFrom, expectedTo }) => {
      const span = Date.parse(expectedTo) - Date.parse(expectedFrom);
      return span > 0 && span <= 24 * 60 * 60 * 1000;
    },
    {
      path: ['expectedTo'],
      message: 'End within 24 hours after the start.',
    },
  );

type DeliveryRpcError = { code?: string };

export type DeliveryEntry = {
  id: string;
  unit_id: string;
  company: string;
  delivery_person: string | null;
  delivery_type: string;
  photo_path: string | null;
  status: string;
  created_at: string;
  respond_by: string | null;
  is_response_overdue?: boolean;
  decision_source: string | null;
  decided_at: string | null;
  handled_by_guard_id: string;
  received_at: string | null;
  collected_at: string | null;
  collected_by: string | null;
  is_uncollected_overdue?: boolean;
  photo_url?: string;
};

export type DeliveryUnitOption = {
  id: string;
  number: string;
  block: string | null;
  canManagePreference?: boolean;
};

export type DeliveryPreference = {
  society_id: string;
  unit_id: string;
  rule: z.infer<typeof preferenceSchema>;
  updated_at: string | null;
};

type DeliverySettings = z.infer<typeof deliverySettingsSchema> & {
  response_timeout_minutes: number;
  uncollected_days: number;
  leave_at_gate_enabled: boolean;
};

async function getContext(
  permission:
    | 'delivery:list'
    | 'delivery:create'
    | 'delivery:respond'
    | 'delivery:override'
    | 'delivery:collect'
    | 'delivery:preference:read'
    | 'delivery:preference:manage'
    | 'delivery:settings:manage'
    | 'delivery:announce',
  write = false,
) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { moduleKey: 'delivery', permission, write });
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
      ? (error.cause as DeliveryRpcError)
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
    throw new ValidationError({ form: 'Check the delivery details.' });
  }
  if (cause.code === '54000') {
    throw new AppError('CONFLICT', {
      reason: 'limit_reached',
      message: 'This unit already has 20 expected deliveries.',
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

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const { context, societyId } = await getContext('delivery:list');
  const settings = await rpc<unknown>(
    context,
    'delivery_settings_get',
    { p_society_id: societyId },
    'Could not load delivery settings.',
  );
  return {
    response_timeout_minutes: 3,
    uncollected_days: 3,
    leave_at_gate_enabled: true,
    ...deliverySettingsSchema.parse(settings),
  };
}

export async function updateDeliverySettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'delivery:settings:manage',
    true,
  );
  const settings = parseInput(deliverySettingsSchema, input);
  return rpc<DeliverySettings>(
    context,
    'delivery_settings_update',
    { p_society_id: societyId, p_settings: settings, p_request_id: requestId },
    'Could not update delivery settings.',
  );
}

export async function getDeliveryRealtimeSocietyId() {
  return (await getContext('delivery:list')).societyId;
}

export async function getDeliveryAdminAccess() {
  const { context } = await getContext('delivery:list');
  if (!context.roles.some((role) => ['admin', 'committee'].includes(role))) {
    throw new AppError('FORBIDDEN');
  }
  return { canManage: context.roles.includes('admin') };
}

export async function requireDeliveryResident() {
  const { context } = await getContext('delivery:list');
  if (!context.roles.includes('resident')) throw new AppError('FORBIDDEN');
}

export async function getDeliverySocietyTimezone() {
  const { context, societyId } = await getContext('delivery:list');
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

export async function listDeliveryUnits(
  scope: 'available' | 'own' = 'available',
): Promise<DeliveryUnitOption[]> {
  const { context, societyId } = await getContext('delivery:list');
  if (scope === 'own' && !context.roles.includes('resident')) {
    throw new AppError('FORBIDDEN');
  }
  let unitIds: string[] | null = null;
  if (
    scope === 'own' ||
    (context.roles.includes('resident') &&
      !context.roles.some((role) =>
        ['admin', 'committee', 'guard'].includes(role),
      ))
  ) {
    const { data: occupants, error: occupantError } = await context.db
      .from('unit_occupants')
      .select('unit_id, is_approver')
      .eq('society_id', societyId)
      .eq('status', 'active');
    if (occupantError) {
      throw new Error('Could not load occupied units.', {
        cause: occupantError,
      });
    }
    unitIds = [...new Set(occupants.map(({ unit_id }) => unit_id))];
    if (unitIds.length === 0) return [];
    const approverUnitIds = new Set(
      occupants
        .filter(({ is_approver }) => is_approver)
        .map(({ unit_id }) => unit_id),
    );
    const units = await loadDeliveryUnits(context, societyId, unitIds);
    return units.map((unit) => ({
      ...unit,
      canManagePreference: approverUnitIds.has(unit.id),
    }));
  }
  return loadDeliveryUnits(context, societyId, unitIds);
}

async function loadDeliveryUnits(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  societyId: string,
  unitIds: string[] | null,
): Promise<DeliveryUnitOption[]> {
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

export async function listDeliveryEntries(
  scope: 'all' | 'waiting' | 'uncollected' | 'today',
): Promise<DeliveryEntry[]> {
  const { context, societyId } = await getContext('delivery:list');
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
      rpc<DeliveryEntry[]>(
        context,
        'delivery_list_entries',
        { p_society_id: societyId, p_unit_id: unitId, p_scope: scope },
        'Could not load delivery entries.',
      ),
    ),
  );
  const entries = result
    .flat()
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  if (
    !context.roles.some((role) =>
      ['admin', 'committee', 'guard'].includes(role),
    )
  ) {
    return entries;
  }
  return Promise.all(
    entries.map(async (entry) => {
      if (!entry.photo_path) return entry;
      const { data, error } = await context.db.storage
        .from('delivery-photos')
        .createSignedUrl(entry.photo_path, 300);
      if (error || !data) {
        throw new Error('Could not issue a delivery photo view URL.', {
          cause: error,
        });
      }
      return { ...entry, photo_url: data.signedUrl };
    }),
  );
}

export async function createDeliveryEntry(input: unknown, requestId: string) {
  const { context, societyId } = await getContext('delivery:create', true);
  const parsed = parseInput(deliveryInputSchema, input);
  const guardId = await currentGuardId(context, parsed.guardId);
  if (parsed.photoPath) {
    await verifyFileAttachment(context, {
      bucket: 'delivery-photos',
      contentTypes: ['image/jpeg', 'image/png'],
      maxBytes: 5 * 1024 * 1024,
      ownerPath: `${societyId}/${parsed.unitId}/deliveries`,
      path: parsed.photoPath,
      societyId,
    });
  }
  return privilegedRpc(
    retryOnceOnDuplicate(() =>
      createDeliveryEntryPrivileged<DeliveryEntry>({
        p_actor_id: context.userId,
        p_society_id: societyId,
        p_unit_id: parsed.unitId,
        p_guard_id: guardId,
        p_company: parsed.company,
        p_delivery_person: parsed.deliveryPerson,
        p_delivery_type: parsed.deliveryType,
        p_photo_path: parsed.photoPath,
        p_client_request_id: parsed.clientRequestId,
        p_request_id: requestId,
      }),
    ),
    'Could not create the delivery entry.',
  );
}

export async function respondToDelivery(
  entryId: string,
  decision: unknown,
  requestId: string,
) {
  const { context } = await getContext('delivery:respond', true);
  const parsedId = uuid.safeParse(entryId);
  const parsedDecision = decisionSchema.safeParse(decision);
  if (!parsedId.success || !parsedDecision.success) {
    throw new ValidationError({ form: 'Choose a delivery and response.' });
  }
  return rpc<DeliveryEntry>(
    context,
    'delivery_respond',
    {
      p_entry_id: parsedId.data,
      p_decision: parsedDecision.data,
      p_request_id: requestId,
    },
    'Could not record the delivery response.',
  );
}

export async function overrideDelivery(
  entryId: string,
  decision: unknown,
  reason: string,
  requestId: string,
) {
  const { context } = await getContext('delivery:override', true);
  const guard = await requireIdentifiedGuard();
  const parsedId = uuid.safeParse(entryId);
  const parsedDecision = overrideDecisionSchema.safeParse(decision);
  const parsedReason = z.string().trim().min(1).max(500).safeParse(reason);
  if (!parsedId.success || !parsedDecision.success || !parsedReason.success) {
    throw new ValidationError({
      form: 'Provide a delivery, decision, and reason.',
    });
  }
  return privilegedRpc(
    overrideDeliveryPrivileged<DeliveryEntry>({
      p_actor_id: context.userId,
      p_entry_id: parsedId.data,
      p_guard_id: guard.id,
      p_decision: parsedDecision.data,
      p_reason: parsedReason.data,
      p_request_id: requestId,
    }),
    'Could not override the delivery request.',
  );
}

export async function markDeliveryCollected(
  entryId: string,
  requestId: string,
) {
  const parsedId = uuid.safeParse(entryId);
  if (!parsedId.success) {
    throw new ValidationError({ entryId: 'Choose a delivery.' });
  }
  const { context } = await getContext('delivery:collect', true);
  if (context.roles.includes('guard')) {
    const guard = await requireIdentifiedGuard();
    return privilegedRpc(
      collectDeliveryAsGuardPrivileged<DeliveryEntry>({
        p_actor_id: context.userId,
        p_entry_id: parsedId.data,
        p_guard_id: guard.id,
        p_request_id: requestId,
      }),
      'Could not mark the delivery collected.',
    );
  }
  return rpc<DeliveryEntry>(
    context,
    'delivery_mark_collected_resident',
    { p_entry_id: parsedId.data, p_request_id: requestId },
    'Could not mark the delivery collected.',
  );
}

export async function getDeliveryPreference(unitId: string) {
  const { context, societyId } = await getContext('delivery:preference:read');
  const parsedUnitId = uuid.safeParse(unitId);
  if (!parsedUnitId.success) {
    throw new ValidationError({ unitId: 'Choose a unit.' });
  }
  const preferences = await rpc<DeliveryPreference[]>(
    context,
    'delivery_preference_get',
    { p_society_id: societyId, p_unit_id: parsedUnitId.data },
    'Could not load the delivery preference.',
  );
  const preference = preferences[0];
  if (!preference) {
    throw new Error('The delivery preference response was empty.');
  }
  return preference;
}

export async function setDeliveryPreference(
  unitId: string,
  rule: unknown,
  requestId: string,
) {
  const { context } = await getContext('delivery:preference:manage', true);
  const parsedUnitId = uuid.safeParse(unitId);
  const parsedRule = preferenceSchema.safeParse(rule);
  if (!parsedUnitId.success || !parsedRule.success) {
    throw new ValidationError({ form: 'Choose a valid delivery preference.' });
  }
  return rpc<DeliveryPreference>(
    context,
    'delivery_preference_set',
    {
      p_unit_id: parsedUnitId.data,
      p_rule: parsedRule.data,
      p_request_id: requestId,
    },
    'Could not update the delivery preference.',
  );
}

export type DeliveryPreAnnouncement = {
  id: string;
  unit_id: string;
  platform: string;
  expected_from: string;
  expected_to: string;
  status: 'expected' | 'cancelled';
  created_at: string;
};

export async function listDeliveryPreAnnouncements(
  unitIds?: string[],
): Promise<DeliveryPreAnnouncement[]> {
  const { context, societyId } = await getContext('delivery:list');
  const staff = context.roles.some((role) =>
    ['admin', 'committee', 'guard'].includes(role),
  );
  let scope: (string | null)[];
  if (unitIds) {
    const parsed = z.array(uuid).max(50).safeParse(unitIds);
    if (!parsed.success)
      throw new ValidationError({ unitId: 'Choose a unit.' });
    scope = parsed.data;
  } else if (staff) {
    scope = [null];
  } else {
    throw new AppError('FORBIDDEN');
  }
  const result = await Promise.all(
    scope.map((unitId) =>
      rpc<DeliveryPreAnnouncement[]>(
        context,
        'delivery_pre_announce_list',
        { p_society_id: societyId, p_unit_id: unitId },
        'Could not load expected deliveries.',
      ),
    ),
  );
  return result
    .flat()
    .sort((left, right) =>
      left.expected_from.localeCompare(right.expected_from),
    );
}

export async function preAnnounceDelivery(input: unknown, requestId: string) {
  const { context, societyId } = await getContext('delivery:announce', true);
  const parsed = parseInput(preAnnounceSchema, input);
  return rpc<DeliveryPreAnnouncement>(
    context,
    'delivery_pre_announce_create',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unitId,
      p_platform: parsed.platform,
      p_expected_from: parsed.expectedFrom,
      p_expected_to: parsed.expectedTo,
      p_client_request_id: parsed.clientRequestId,
      p_request_id: requestId,
    },
    'Could not save the expected delivery.',
  );
}

export async function cancelDeliveryPreAnnouncement(
  announcementId: string,
  requestId: string,
) {
  const { context, societyId } = await getContext('delivery:announce', true);
  const parsedId = uuid.safeParse(announcementId);
  if (!parsedId.success) {
    throw new ValidationError({
      announcementId: 'Choose an expected delivery.',
    });
  }
  return rpc<DeliveryPreAnnouncement>(
    context,
    'delivery_pre_announce_cancel',
    {
      p_society_id: societyId,
      p_announcement_id: parsedId.data,
      p_request_id: requestId,
    },
    'Could not cancel the expected delivery.',
  );
}
