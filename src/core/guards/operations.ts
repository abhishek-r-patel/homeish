// Enforce Core guard-roster, gate-settings and contact permissions on the server.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { listSocietyMembers } from '../members/operations';
import { readGuardDutyCookie, setGuardDutyCookie } from './session';

const guardIdSchema = z.string().uuid();
const addGuardSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    membershipId: z.string().uuid().nullable(),
  })
  .strict();
const updateGuardSchema = z
  .object({
    guardId: guardIdSchema,
    name: z.string().trim().min(1).max(80),
    active: z.boolean(),
  })
  .strict();
const setPinSchema = z
  .object({
    guardId: guardIdSchema,
    pin: z.string().regex(/^[0-9]{4,6}$/),
  })
  .strict();
const gateSettingsSchema = z
  .object({
    gateLoginMode: z.enum(['individual', 'shared']),
    guardIdentification: z.enum(['pick_name', 'pin']),
  })
  .strict();

export interface GuardRosterItem {
  id: string;
  name: string;
  membership_id: string | null;
  active: boolean;
}

export interface GuardDutyState {
  mode: 'individual' | 'shared';
  identification: 'pick_name' | 'pin';
  currentGuard: { id: string; name: string } | null;
  guards: readonly Pick<GuardRosterItem, 'id' | 'name'>[];
}

async function guardContext(
  permission:
    | 'guards:manage'
    | 'guards:read'
    | 'gate:settings'
    | 'guard:identify'
    | 'contacts:read',
  write = false,
) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { moduleKey: 'core', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseForm<T>(schema: z.ZodType<T>, formData: FormData): T {
  const parsed = schema.safeParse(
    Object.fromEntries(
      [...formData.entries()].filter(([name]) => !name.startsWith('$ACTION_')),
    ),
  );
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

function raiseGuardRpcError(
  label: string,
  error: { code?: string; message: string } | null,
): void {
  if (!error) return;
  if (error.code === '42501') throw new AppError('FORBIDDEN');
  if (error.code === 'P0002') throw new AppError('NOT_FOUND');
  if (error.code === '23505' || error.code === '23514') {
    throw new AppError('CONFLICT', {
      reason: 'invalid_state',
      message: error.message,
    });
  }
  if (error.code === '22023') {
    throw new ValidationError({ form: error.message });
  }
  throw new Error(label, { cause: error });
}

async function getGateConfig(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
) {
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const { data, error } = await context.db
    .from('societies')
    .select('gate_login_mode, guard_identification')
    .eq('id', context.societyId)
    .single();
  if (error) {
    throw new Error('Could not load gate settings.', { cause: error });
  }
  if (
    (data.gate_login_mode !== 'individual' &&
      data.gate_login_mode !== 'shared') ||
    (data.guard_identification !== 'pick_name' &&
      data.guard_identification !== 'pin')
  ) {
    throw new Error('The society has unsupported gate settings.');
  }
  return {
    mode: data.gate_login_mode,
    identification: data.guard_identification,
  } as const;
}

export async function listGuards(): Promise<{
  canManage: boolean;
  gateLoginMode: 'individual' | 'shared';
  guardIdentification: 'pick_name' | 'pin';
  guards: readonly GuardRosterItem[];
  memberships: readonly { id: string; label: string }[];
}> {
  const { context, societyId } = await guardContext('guards:read');
  const [rosterResult, config, members] = await Promise.all([
    context.db
      .from('guard_roster')
      .select('id, name, membership_id, active')
      .eq('society_id', societyId)
      .order('name'),
    getGateConfig(context),
    context.roles.includes('admin') || context.roles.includes('committee')
      ? listSocietyMembers()
      : Promise.resolve({ members: [] as const }),
  ]);
  if (rosterResult.error) {
    throw new Error('Could not load the guard roster.', {
      cause: rosterResult.error,
    });
  }
  return {
    canManage: context.roles.includes('admin'),
    gateLoginMode: config.mode,
    guardIdentification: config.identification,
    guards: rosterResult.data,
    memberships: members.members
      .filter(
        (member) =>
          member.status === 'active' && member.roles.includes('guard'),
      )
      .map((member) => ({
        id: member.membership_id,
        label: member.full_name ?? member.email,
      })),
  };
}

export async function addGuard(formData: FormData, requestId: string) {
  const { context, societyId } = await guardContext('guards:manage', true);
  const parsed = addGuardSchema.safeParse({
    name: formData.get('name'),
    membershipId: formData.get('membershipId') || null,
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
  const config = await getGateConfig(context);
  if (
    (config.mode === 'individual' && !parsed.data.membershipId) ||
    (config.mode === 'shared' && parsed.data.membershipId)
  ) {
    throw new ValidationError({
      membershipId:
        config.mode === 'individual'
          ? 'Choose the active guard account.'
          : 'Shared gate guards do not use separate accounts.',
    });
  }
  const addGuardRpc = context.db.rpc.bind(context.db) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { code?: string; message: string } | null }>;
  const { error } = await addGuardRpc('admin_add_guard', {
    p_society_id: societyId,
    p_name: parsed.data.name,
    p_membership_id: parsed.data.membershipId,
    p_request_id: requestId,
  });
  raiseGuardRpcError('Could not add the guard.', error);
}

export async function updateGuard(formData: FormData, requestId: string) {
  const { context, societyId } = await guardContext('guards:manage', true);
  const parsed = updateGuardSchema.safeParse({
    guardId: formData.get('guardId'),
    name: formData.get('name'),
    active: formData.get('active') === 'on',
  });
  if (!parsed.success) {
    throw new ValidationError({
      form: parsed.error.issues[0]?.message ?? 'Check the guard details.',
    });
  }
  const { error } = await context.db.rpc('admin_update_guard', {
    p_society_id: societyId,
    p_guard_id: parsed.data.guardId,
    p_name: parsed.data.name,
    p_active: parsed.data.active,
    p_request_id: requestId,
  });
  raiseGuardRpcError('Could not update the guard.', error);
}

export async function setGuardPin(formData: FormData, requestId: string) {
  const { context, societyId } = await guardContext('guards:manage', true);
  const parsed = parseForm(setPinSchema, formData);
  const config = await getGateConfig(context);
  if (config.mode !== 'shared' || config.identification !== 'pin') {
    throw new ValidationError({
      pin: 'PIN identification is not enabled for this society.',
    });
  }
  const { error } = await context.db.rpc('admin_set_guard_pin', {
    p_society_id: societyId,
    p_guard_id: parsed.guardId,
    p_pin: parsed.pin,
    p_request_id: requestId,
  });
  raiseGuardRpcError('Could not save the guard PIN.', error);
}

export async function updateGateSettings(
  formData: FormData,
  requestId: string,
) {
  const { context, societyId } = await guardContext('gate:settings', true);
  const parsed = parseForm(gateSettingsSchema, formData);
  const { error } = await context.db.rpc('admin_update_gate_settings', {
    p_society_id: societyId,
    p_gate_login_mode: parsed.gateLoginMode,
    p_guard_identification: parsed.guardIdentification,
    p_request_id: requestId,
  });
  raiseGuardRpcError('Could not update gate settings.', error);
}

export async function getGuardDutyState(): Promise<GuardDutyState> {
  const { context, societyId } = await guardContext('guards:read');
  const config = await getGateConfig(context);
  const rosterResult = await context.db
    .from('guard_roster')
    .select('id, name')
    .eq('society_id', societyId)
    .eq('active', true)
    .order('name');
  if (rosterResult.error) {
    throw new Error('Could not load active guards.', {
      cause: rosterResult.error,
    });
  }

  if (config.mode === 'individual') {
    const { data, error } = await context.db.rpc('guard_identify', {
      p_society_id: societyId,
    });
    raiseGuardRpcError('Could not identify the signed-in guard.', error);
    const resolved = data?.[0];
    return {
      mode: config.mode,
      identification: config.identification,
      currentGuard:
        resolved?.guard_id && resolved.guard_name
          ? { id: resolved.guard_id, name: resolved.guard_name }
          : null,
      guards: rosterResult.data,
    };
  }

  const guardId = await readGuardDutyCookie(context);
  const currentGuard = guardId
    ? (rosterResult.data.find(({ id }) => id === guardId) ?? null)
    : null;
  return {
    mode: config.mode,
    identification: config.identification,
    currentGuard,
    guards: rosterResult.data,
  };
}

export async function identifyGuard(input: unknown) {
  const parsed = z
    .object({
      guardId: guardIdSchema,
      pin: z.string().max(6).optional(),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ form: 'Choose a guard to identify.' });
  }
  const { context, societyId } = await guardContext('guard:identify', true);
  const { data, error } = await context.db.rpc('guard_identify', {
    p_society_id: societyId,
    p_guard_id: parsed.data.guardId,
    p_pin: parsed.data.pin,
  });
  raiseGuardRpcError('Could not identify the guard.', error);
  const result = data?.[0];
  if (result?.locked) {
    throw new AppError('RATE_LIMITED', {
      retryAfterSeconds: result.retry_after_seconds ?? 900,
    });
  }
  if (!result?.guard_id) {
    throw new AppError('UNAUTHENTICATED', {
      message: 'The guard name or PIN is not correct.',
    });
  }
  await setGuardDutyCookie(context, result.guard_id);
  return { name: result.guard_name };
}

export async function guardUnitContacts(unitId: string) {
  const parsed = guardIdSchema.safeParse(unitId);
  if (!parsed.success) {
    throw new ValidationError({ unitId: 'Choose a valid unit.' });
  }
  const { context } = await guardContext('contacts:read');
  const { data, error } = await context.db.rpc('guard_unit_contacts', {
    p_unit_id: parsed.data,
  });
  raiseGuardRpcError('Could not load the unit contacts.', error);
  return data ?? [];
}

export async function requireIdentifiedGuard(): Promise<{
  id: string;
  name: string;
}> {
  const state = await getGuardDutyState();
  if (!state.currentGuard) throw new AppError('GUARD_NOT_IDENTIFIED');
  return state.currentGuard;
}
