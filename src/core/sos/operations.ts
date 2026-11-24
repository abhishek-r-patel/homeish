// Authorise emergency SOS operations and validate their database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, ConflictError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import { canAdminEditAllModuleSettings } from '../modules/setting-access';
import {
  sosAlertInputSchema,
  sosCloseInputSchema,
  sosContactArchiveInputSchema,
  sosContactInputSchema,
  sosPageInputSchema,
  sosRaiseInputSchema,
  sosSettingsInputSchema,
  sosUpdateInputSchema,
  sosWorkspaceSchema,
} from './validation';

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
  rateLimited = write,
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'sos', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (rateLimited) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

function databaseCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const parsed = z.object({ code: z.string() }).safeParse(current);
    if (parsed.success) return parsed.data.code;
    current = current instanceof Error ? current.cause : undefined;
  }
  return undefined;
}

// The database enforces one open alert per unit and three per rolling hour.
async function withSosLimits<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code = databaseCode(error);
    if (code === '55000') {
      throw new ConflictError(
        'limit_reached',
        'An SOS is already open for this unit. Responders have been alerted; follow its status below.',
      );
    }
    if (code === '54000') {
      throw new AppError('RATE_LIMITED', {
        message:
          'This unit has raised 3 SOS alerts in the last hour. Call an emergency number below for help now.',
      });
    }
    throw error;
  }
}

export async function getSosWorkspace(input: unknown = {}) {
  const { context, societyId } = await getContext('sos:list');
  const page = parseModuleInput(sosPageInputSchema, input);
  const [workspace, canEditSettings] = await Promise.all([
    callModuleRpc(
      context,
      'sos_workspace',
      { p_society_id: societyId, p_limit: page.limit, p_offset: page.offset },
      sosWorkspaceSchema,
      'Could not load emergency alerts. Refresh and retry, or call an emergency number.',
    ),
    canAdminEditAllModuleSettings('sos', context),
  ]);
  return { ...workspace, can_edit_settings: canEditSettings };
}

export async function raiseSos(input: unknown, requestId: string) {
  // Emergencies skip the generic write limiter; the database applies SOS limits.
  const { context, societyId } = await getContext(
    'sos:raise',
    true,
    requestId,
    false,
  );
  const values = parseModuleInput(sosRaiseInputSchema, input);
  return withSosLimits(() =>
    callModuleRpc(
      context,
      'sos_raise',
      {
        p_society_id: societyId,
        p_unit_id: values.unitId,
        p_category: values.category,
        p_note: values.note,
        p_client_request_id: values.clientRequestId,
        p_request_id: context.requestId,
      },
      z.uuid(),
      'The SOS was not sent. Choose a category and your unit, then retry or call an emergency number.',
    ),
  );
}

export async function acknowledgeSos(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'sos:respond',
    true,
    requestId,
  );
  const values = parseModuleInput(sosAlertInputSchema, input);
  await callModuleRpc(
    context,
    'sos_acknowledge',
    {
      p_society_id: societyId,
      p_alert_id: values.alertId,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not acknowledge this SOS. Refresh and retry.',
  );
}

export async function addSosUpdate(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'sos:respond',
    true,
    requestId,
  );
  const values = parseModuleInput(sosUpdateInputSchema, input);
  await callModuleRpc(
    context,
    'sos_add_update',
    {
      p_society_id: societyId,
      p_alert_id: values.alertId,
      p_note: values.note,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not post this update. Acknowledge the SOS first and keep the update under 500 characters.',
  );
}

export async function closeSos(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'sos:respond',
    true,
    requestId,
  );
  const values = parseModuleInput(sosCloseInputSchema, input);
  await callModuleRpc(
    context,
    'sos_close',
    {
      p_society_id: societyId,
      p_alert_id: values.alertId,
      p_reason: values.reason,
      p_note: values.note,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not close this SOS. Acknowledge it first and add a note for false alarms or other reasons.',
  );
}

export async function cancelSos(input: unknown, requestId: string) {
  const { context, societyId } = await getContext('sos:raise', true, requestId);
  const values = parseModuleInput(sosAlertInputSchema, input);
  await callModuleRpc(
    context,
    'sos_cancel',
    {
      p_society_id: societyId,
      p_alert_id: values.alertId,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not cancel this SOS. It may already have been acknowledged.',
  );
}

export async function saveSosSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'sos:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(sosSettingsInputSchema, input);
  await callModuleRpc(
    context,
    'sos_settings_update',
    {
      p_society_id: societyId,
      p_notify_guards: values.notifyGuards,
      p_notify_admins: values.notifyAdmins,
      p_notify_committee: values.notifyCommittee,
      p_resident_scope: values.residentScope,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save SOS recipients. Keep at least one responder group notified.',
  );
}

export async function saveSosContact(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'sos:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(sosContactInputSchema, input);
  return callModuleRpc(
    context,
    'sos_contact_save',
    {
      p_society_id: societyId,
      p_contact_id: values.contactId,
      p_label: values.label,
      p_phone: values.phone,
      p_sort_order: values.sortOrder,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Could not save the contact. Use a short name and a phone number with digits, spaces or hyphens.',
  );
}

export async function setSosContactArchived(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'sos:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(sosContactArchiveInputSchema, input);
  await callModuleRpc(
    context,
    'sos_contact_set_archived',
    {
      p_society_id: societyId,
      p_contact_id: values.contactId,
      p_archived: values.archived,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not update the contact. Refresh and retry.',
  );
}

// Recipients dismiss their own banner; the database checks membership and module state.
export async function dismissSosAlert(input: unknown, requestId: string) {
  const context = await buildRequestContext(requestId);
  const values = parseModuleInput(sosAlertInputSchema, input);
  await callModuleRpc(
    context,
    'sos_alert_dismiss',
    { p_alert_id: values.alertId, p_request_id: context.requestId },
    z.null(),
    'Could not dismiss this alert. Refresh and retry.',
  );
}
