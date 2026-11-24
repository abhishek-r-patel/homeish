// Read and save own P54 workspace preferences and developer action defaults.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError, createRequestId, ValidationError } from '../errors';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import { QUICK_ACTION_KEYS, resolveQuickActions } from './quick-actions';
import type { SocietyRole } from '../permissions';

const startingPlaceSchema = z.enum([
  'last_used',
  'home',
  'work',
  'gate',
  'housekeeping',
]);
const graphModeSchema = z.enum(['water', 'bills']);
const preferenceSchema = z
  .object({
    starting_place: startingPlaceSchema,
    resident_graph_mode: graphModeSchema,
  })
  .strict();
const actionKeysSchema = z
  .array(z.string().trim().min(1).max(80))
  .min(1)
  .max(12);
const pinKeysSchema = z.array(z.enum(QUICK_ACTION_KEYS)).max(8);
const optionalActionKeysSchema = pinKeysSchema.nullable();

export async function readWorkspacePreferences(context?: RequestContext) {
  const resolvedContext =
    context ?? (await buildRequestContext(createRequestId()));
  if (!resolvedContext.societyId) {
    return {
      startingPlace: 'last_used' as const,
      residentGraphMode: 'water' as const,
    };
  }
  const { data, error } = await resolvedContext.db.rpc(
    'person_workspace_preferences_get',
    { p_society_id: resolvedContext.societyId },
  );
  if (error) {
    if (error.code === '42501') throw new AppError('FORBIDDEN');
    throw new Error('Could not load your workspace preferences.', {
      cause: error,
    });
  }
  const rows = z.array(preferenceSchema).parse(data);
  const preference = rows[0];
  return preference
    ? {
        startingPlace: preference.starting_place,
        residentGraphMode: preference.resident_graph_mode,
      }
    : {
        startingPlace: 'last_used' as const,
        residentGraphMode: 'water' as const,
      };
}

export async function saveStartingPlace(formData: FormData) {
  const parsed = startingPlaceSchema.safeParse(formData.get('startingPlace'));
  if (!parsed.success) {
    throw new ValidationError({
      startingPlace: 'Choose where Homeish should open.',
    });
  }
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const { error } = await context.db.rpc('person_workspace_preferences_save', {
    p_society_id: context.societyId,
    p_starting_place: parsed.data,
  });
  if (error) {
    if (error.code === '42501') throw new AppError('FORBIDDEN');
    throw new Error('Could not save your starting place.', { cause: error });
  }
}

export async function saveResidentGraphMode(input: unknown) {
  const parsed = graphModeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ graphMode: 'Choose a supported graph.' });
  }
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId || !context.roles.includes('resident')) {
    throw new AppError('FORBIDDEN');
  }
  const { error } = await context.db.rpc('person_workspace_preferences_save', {
    p_society_id: context.societyId,
    p_starting_place: (await readWorkspacePreferences(context)).startingPlace,
    p_resident_graph_mode: parsed.data,
  });
  if (error) {
    if (error.code === '42501') throw new AppError('FORBIDDEN');
    throw new Error('Could not save your graph preference.', {
      cause: error,
    });
  }
}

export async function getConfiguredQuickActions(
  context: RequestContext,
  role: SocietyRole,
) {
  const societyId = context.societyId;
  if (!societyId) throw new AppError('FORBIDDEN');
  if (!context.roles.includes(role)) throw new AppError('FORBIDDEN');
  const [keys, pins] = await Promise.all([
    callModuleRpc(
      context,
      'workspace_quick_action_defaults_get',
      { p_society_id: societyId, p_role: role },
      actionKeysSchema,
      'Quick actions could not be loaded.',
    ),
    callModuleRpc(
      context,
      'workspace_quick_action_pins_get',
      { p_society_id: societyId },
      optionalActionKeysSchema,
      'Pinned actions could not be loaded.',
    ),
  ]);
  const selectedKeys = pins ?? keys;
  return resolveQuickActions(role, [...context.enabledModules], selectedKeys);
}

export async function getAllowedQuickActions(
  context: RequestContext,
  requestedRole?: SocietyRole,
) {
  const roles = context.roles;
  const role =
    requestedRole ??
    (roles.includes('resident')
      ? 'resident'
      : roles.includes('admin')
        ? 'admin'
        : roles.includes('committee')
          ? 'committee'
          : roles.includes('guard')
            ? 'guard'
            : roles.includes('hk_supervisor')
              ? 'hk_supervisor'
              : null);
  if (!role) throw new AppError('FORBIDDEN');
  if (!roles.includes(role)) throw new AppError('FORBIDDEN');
  return resolveQuickActions(
    role,
    [...context.enabledModules],
    QUICK_ACTION_KEYS,
  );
}

export async function saveQuickActionPins(input: unknown) {
  const parsed = z.array(z.enum(QUICK_ACTION_KEYS)).max(8).safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({
      actions: 'Choose up to 8 supported actions, with each action shown once.',
    });
  }
  if (new Set(parsed.data).size !== parsed.data.length) {
    throw new ValidationError({ actions: 'Pin each action only once.' });
  }
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const valid = new Set(
    (await getAllowedQuickActions(context)).map((action) => action.key),
  );
  if (parsed.data.some((key) => !valid.has(key))) {
    throw new AppError('FORBIDDEN');
  }
  return callModuleRpc(
    context,
    'workspace_quick_action_pins_save',
    { p_society_id: context.societyId, p_action_keys: parsed.data },
    pinKeysSchema,
    'Pinned actions could not be saved.',
  );
}

export async function resetQuickActionPins() {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return callModuleRpc(
    context,
    'workspace_quick_action_pins_reset',
    { p_society_id: context.societyId },
    z.null(),
    'Pinned actions could not be reset.',
  );
}
