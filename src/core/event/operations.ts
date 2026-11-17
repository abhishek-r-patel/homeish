// Authorize Events & RSVPs operations, call their RPC contracts and deliver follow-up pushes.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import {
  AppError,
  ConflictError,
  createRequestId,
  ValidationError,
} from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  eventAdminFilterSchema,
  eventAdminGetSchema,
  eventAdminListSchema,
  eventBlockOptionsSchema,
  eventCancelInputSchema,
  eventCancelResultSchema,
  eventCreateInputSchema,
  eventDeletedResultSchema,
  eventIdInputSchema,
  eventMemberFilterSchema,
  eventMemberGetSchema,
  eventMemberListSchema,
  eventPublishResultSchema,
  eventRsvpInputSchema,
  eventRsvpResultSchema,
  eventUpdateInputSchema,
  eventUpdateResultSchema,
  eventVersionInputSchema,
  eventWriteResultSchema,
} from './validation';

type EventPermission = 'event:attend' | 'event:list' | 'event:manage';

type Context = Awaited<ReturnType<typeof buildRequestContext>>;

async function getContext(
  permission: EventPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'event', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

function rpcError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) return null;
    const record = current as {
      cause?: unknown;
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    if (typeof record.code === 'string') {
      return {
        code: record.code,
        message: typeof record.message === 'string' ? record.message : '',
        details: typeof record.details === 'string' ? record.details : '',
      };
    }
    current = record.cause;
  }
  return null;
}

export const EVENT_READINESS_MESSAGES: Readonly<Record<string, string>> = {
  title_missing: 'Add a title.',
  venue_missing: 'Add a venue.',
  time_invalid:
    'Choose a future start time and an end time within 14 days after it.',
  deadline_invalid:
    'Choose an RSVP deadline in the future and on or before the start time.',
  audience_empty: 'Choose at least one active block, or invite everyone.',
};

export function mapEventError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const info = rpcError(error);
  if (info?.code === '55P03') {
    throw new ConflictError(
      'invalid_state',
      'This event is busy. Wait a moment, then try again.',
    );
  }
  if (info?.code !== 'P0001') throw error;

  switch (info.message) {
    case 'event_invalid_state':
      throw new ConflictError(
        'invalid_state',
        'This event is not in a state that allows this change. Refresh and retry.',
      );
    case 'event_rsvp_closed':
      throw new ConflictError(
        'invalid_state',
        'RSVPs are closed for this event.',
      );
    case 'event_full':
      throw new ConflictError(
        'invalid_state',
        'Sorry, there are not enough places left for this many people.',
      );
    case 'event_billing_required':
      throw new ConflictError(
        'invalid_state',
        'This event has a contribution, so Billing must be turned on first.',
      );
    case 'event_headcount_limit':
      throw new ValidationError(
        { headcount: 'That is more people than each flat may bring.' },
        'Reduce the number of people and try again.',
      );
    case 'event_capacity_below_going':
      throw new ValidationError(
        {
          capacity:
            'More people are already going than this capacity. Choose a higher number.',
        },
        'The capacity is lower than the people already going.',
      );
    case 'event_not_in_audience':
      throw new AppError('FORBIDDEN');
    case 'event_not_ready': {
      const keys = info.details
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      throw new ValidationError(
        Object.fromEntries(
          (keys.length > 0 ? keys : ['form']).map((key) => [
            key,
            EVENT_READINESS_MESSAGES[key] ?? 'Check the event details.',
          ]),
        ),
        'This event needs a few changes before it can be published.',
      );
    }
    default:
      throw error;
  }
}

async function callEventRpc<T>(
  context: Context,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  failureMessage: string,
): Promise<T> {
  try {
    return await callModuleRpc(context, name, args, schema, failureMessage);
  } catch (error) {
    return mapEventError(error);
  }
}

async function pushFor(context: Context) {
  await sendNotificationPushesForRequest(context.requestId);
}

// Reads

export async function getEventAdminList(filter: unknown = 'upcoming') {
  const { context, societyId } = await getContext('event:list');
  const list = await callEventRpc(
    context,
    'event_admin_list',
    {
      p_society_id: societyId,
      p_filter: eventAdminFilterSchema.parse(filter),
      p_limit: 100,
      p_offset: 0,
    },
    eventAdminListSchema,
    'Could not load events. Refresh and retry.',
  );
  return {
    ...list,
    billingEnabled: context.enabledModules.has('billing'),
  };
}

export async function getEventAdminDetail(eventId: unknown) {
  const { context, societyId } = await getContext('event:list');
  const values = parseModuleInput(eventIdInputSchema, { eventId });
  return callEventRpc(
    context,
    'event_admin_get',
    { p_society_id: societyId, p_event_id: values.eventId },
    eventAdminGetSchema,
    'Could not load this event. Refresh and retry.',
  );
}

export async function getEventBlockOptions() {
  const { context, societyId } = await getContext('event:manage');
  const result = await callEventRpc(
    context,
    'event_block_options',
    { p_society_id: societyId },
    eventBlockOptionsSchema,
    'Could not load blocks. Refresh and retry.',
  );
  return {
    blocks: result.blocks,
    billingEnabled: context.enabledModules.has('billing'),
  };
}

export async function getEventMemberList(filter: unknown = 'upcoming') {
  const { context, societyId } = await getContext('event:attend');
  return callEventRpc(
    context,
    'event_member_list',
    {
      p_society_id: societyId,
      p_filter: eventMemberFilterSchema.parse(filter),
    },
    eventMemberListSchema,
    'Could not load events. Refresh and retry.',
  );
}

export async function getEventMemberDetail(eventId: unknown) {
  const { context, societyId } = await getContext('event:attend');
  const values = parseModuleInput(eventIdInputSchema, { eventId });
  return callEventRpc(
    context,
    'event_member_get',
    { p_society_id: societyId, p_event_id: values.eventId },
    eventMemberGetSchema,
    'Could not load this event. Refresh and retry.',
  );
}

// Manager writes

export async function createEvent(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'event:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(eventCreateInputSchema, input);
  return callEventRpc(
    context,
    'event_create',
    {
      p_society_id: societyId,
      p_client_request_id: values.clientRequestId,
      p_event: values.event,
      p_request_id: context.requestId,
    },
    eventWriteResultSchema,
    'The event was not created. Check the details and retry.',
  );
}

export async function updateEvent(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'event:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(eventUpdateInputSchema, input);
  const result = await callEventRpc(
    context,
    'event_update',
    {
      p_society_id: societyId,
      p_event_id: values.eventId,
      p_expected_version: values.expectedVersion,
      p_event: values.event,
      p_request_id: context.requestId,
    },
    eventUpdateResultSchema,
    'The event was not saved. Check the details and retry.',
  );
  if (result.notified) await pushFor(context);
  return result;
}

export async function deleteEventDraft(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'event:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(eventVersionInputSchema, input);
  return callEventRpc(
    context,
    'event_draft_delete',
    {
      p_society_id: societyId,
      p_event_id: values.eventId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    eventDeletedResultSchema,
    'The draft was not deleted. Refresh and retry.',
  );
}

export async function publishEvent(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'event:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(eventVersionInputSchema, input);
  const result = await callEventRpc(
    context,
    'event_publish',
    {
      p_society_id: societyId,
      p_event_id: values.eventId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    eventPublishResultSchema,
    'The event was not published. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

export async function cancelEvent(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'event:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(eventCancelInputSchema, input);
  const result = await callEventRpc(
    context,
    'event_cancel',
    {
      p_society_id: societyId,
      p_event_id: values.eventId,
      p_expected_version: values.expectedVersion,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    eventCancelResultSchema,
    'The event was not cancelled. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

// Resident RSVP

export async function setEventRsvp(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'event:attend',
    true,
    requestId,
  );
  const values = parseModuleInput(eventRsvpInputSchema, input);
  return callEventRpc(
    context,
    'event_rsvp_set',
    {
      p_society_id: societyId,
      p_event_id: values.eventId,
      p_unit_id: values.unitId,
      p_status: values.status,
      p_headcount: values.headcount,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    eventRsvpResultSchema,
    'Your RSVP was not saved. Refresh and retry.',
  );
}
