// Authorise Guard Patrol operations and validate their transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  patrolAdminWorkspaceSchema,
  patrolCheckpointActiveInputSchema,
  patrolCheckpointInputSchema,
  patrolGuardWorkspaceSchema,
  patrolHandoverAcknowledgeInputSchema,
  patrolHandoverInputSchema,
  patrolIncidentCloseInputSchema,
  patrolIncidentInputSchema,
  patrolIncidentNoteInputSchema,
  patrolPrintSheetSchema,
  patrolScanInputSchema,
  patrolScanResultSchema,
  patrolScheduleActiveInputSchema,
  patrolScheduleInputSchema,
  patrolSettingsInputSchema,
} from './validation';

function databaseCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const parsed = z.object({ code: z.string() }).safeParse(current);
    if (parsed.success) return parsed.data.code;
    current = current instanceof Error ? current.cause : undefined;
  }
  return undefined;
}

/** Maps the database's program-limit error (54000) to a friendly rate-limit message. */
async function withLimitMessage<T>(message: string, work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof AppError) && databaseCode(error) === '54000') {
      throw new AppError('RATE_LIMITED', { message });
    }
    throw error;
  }
}

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'patrol', permission, write });
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

export async function getPatrolAdminWorkspace() {
  const { context, societyId } = await getContext('patrol:list');
  return callModuleRpc(
    context,
    'patrol_admin_workspace',
    { p_society_id: societyId },
    patrolAdminWorkspaceSchema,
    'Could not load patrol records. Refresh and retry.',
  );
}

export async function getPatrolGuardWorkspace() {
  const { context, societyId } = await getContext('patrol:guard');
  return callModuleRpc(
    context,
    'patrol_guard_workspace',
    { p_society_id: societyId },
    patrolGuardWorkspaceSchema,
    'Could not load the patrol screen. Refresh and retry.',
  );
}

export async function getPatrolPrintSheet() {
  const { context, societyId } = await getContext('patrol:manage');
  return callModuleRpc(
    context,
    'patrol_print_sheet',
    { p_society_id: societyId },
    patrolPrintSheetSchema,
    'Could not load the checkpoint sheet. Refresh and retry.',
  );
}

export async function savePatrolSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(patrolSettingsInputSchema, input);
  await callModuleRpc(
    context,
    'patrol_settings_update',
    {
      p_society_id: societyId,
      p_photo_retention_days: values.photoRetentionDays,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save the photo retention period. Choose 30 to 365 days.',
  );
}

export async function savePatrolCheckpoint(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const checkpoint = parseModuleInput(patrolCheckpointInputSchema, input);
  return withLimitMessage(
    'A society can have up to 200 checkpoints. Turn off or reuse an existing one.',
    () =>
      callModuleRpc(
        context,
        'patrol_checkpoint_save',
        {
          p_society_id: societyId,
          p_checkpoint_id: checkpoint.checkpointId,
          p_name: checkpoint.name,
          p_location_note: checkpoint.locationNote,
          p_expected_version: checkpoint.expectedVersion,
          p_client_request_id: checkpoint.clientRequestId,
          p_request_id: context.requestId,
        },
        z.uuid(),
        'The checkpoint was not saved. Use a name that no other checkpoint uses.',
      ),
  );
}

export async function setPatrolCheckpointActive(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(patrolCheckpointActiveInputSchema, input);
  await callModuleRpc(
    context,
    'patrol_checkpoint_set_active',
    {
      p_society_id: societyId,
      p_checkpoint_id: values.checkpointId,
      p_active: values.active,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The checkpoint was not updated. Refresh and retry.',
  );
}

export async function savePatrolSchedule(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const schedule = parseModuleInput(patrolScheduleInputSchema, input);
  return withLimitMessage(
    'A society can have up to 50 schedules. Turn off or edit an existing one.',
    () =>
      callModuleRpc(
        context,
        'patrol_schedule_save',
        {
          p_society_id: societyId,
          p_schedule_id: schedule.scheduleId,
          p_name: schedule.name,
          p_shift_start: schedule.shiftStart,
          p_shift_end: schedule.shiftEnd,
          p_interval_minutes: schedule.intervalMinutes,
          p_grace_minutes: schedule.graceMinutes,
          p_checkpoint_ids: schedule.checkpointIds,
          p_expected_version: schedule.expectedVersion,
          p_client_request_id: schedule.clientRequestId,
          p_request_id: context.requestId,
        },
        z.uuid(),
        'The schedule was not saved. Use a unique name, a round interval that fits the shift and a grace period within the interval.',
      ),
  );
}

export async function setPatrolScheduleActive(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(patrolScheduleActiveInputSchema, input);
  await callModuleRpc(
    context,
    'patrol_schedule_set_active',
    {
      p_society_id: societyId,
      p_schedule_id: values.scheduleId,
      p_active: values.active,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The schedule was not updated. Refresh and retry.',
  );
}

export async function recordPatrolScan(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:guard',
    true,
    requestId,
  );
  const scan = parseModuleInput(patrolScanInputSchema, input);
  try {
    return await withLimitMessage(
      'Too many scans in the last hour. Wait a few minutes and try again.',
      () =>
        callModuleRpc(
          context,
          'patrol_scan',
          {
            p_society_id: societyId,
            p_code: scan.code,
            p_method: scan.method,
            p_client_request_id: scan.clientRequestId,
            p_request_id: context.requestId,
          },
          patrolScanResultSchema,
          'Enter the 6-character code printed under the QR code.',
        ),
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      throw new AppError('NOT_FOUND', {
        message:
          'No active checkpoint in this society has that code. Check the code and try again.',
      });
    }
    throw error;
  }
}

export async function createPatrolIncident(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:guard',
    true,
    requestId,
  );
  const incident = parseModuleInput(patrolIncidentInputSchema, input);
  return withLimitMessage(
    'You can report 20 incidents an hour. Call the society admin if this is urgent.',
    () =>
      callModuleRpc(
        context,
        'patrol_incident_create',
        {
          p_society_id: societyId,
          p_category: incident.category,
          p_severity: incident.severity,
          p_description: incident.description,
          p_location: incident.location,
          p_photo_paths: incident.photoPaths,
          p_client_request_id: incident.clientRequestId,
          p_request_id: context.requestId,
        },
        z.uuid(),
        'The incident was not reported. Upload the photos again as JPG or PNG files up to 5 MiB.',
      ),
  );
}

export async function addPatrolIncidentNote(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const note = parseModuleInput(patrolIncidentNoteInputSchema, input);
  return withLimitMessage(
    'This incident already has the maximum of 100 notes. Close it with a resolution.',
    () =>
      callModuleRpc(
        context,
        'patrol_incident_note_add',
        {
          p_society_id: societyId,
          p_incident_id: note.incidentId,
          p_body: note.body,
          p_request_id: context.requestId,
        },
        z.uuid(),
        'The note was not added. Notes can only be added to open incidents.',
      ),
  );
}

export async function closePatrolIncident(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(patrolIncidentCloseInputSchema, input);
  await callModuleRpc(
    context,
    'patrol_incident_close',
    {
      p_society_id: societyId,
      p_incident_id: values.incidentId,
      p_resolution: values.resolution,
      p_request_id: context.requestId,
    },
    z.null(),
    'The incident was not closed. Refresh and retry.',
  );
}

export async function createPatrolHandover(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'patrol:guard',
    true,
    requestId,
  );
  const note = parseModuleInput(patrolHandoverInputSchema, input);
  return withLimitMessage(
    'You can write 20 handover notes an hour. Try again later.',
    () =>
      callModuleRpc(
        context,
        'patrol_handover_create',
        {
          p_society_id: societyId,
          p_body: note.body,
          p_client_request_id: note.clientRequestId,
          p_request_id: context.requestId,
        },
        z.uuid(),
        'The handover note was not saved. Keep it within 1000 characters.',
      ),
  );
}

export async function acknowledgePatrolHandover(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'patrol:guard',
    true,
    requestId,
  );
  const values = parseModuleInput(patrolHandoverAcknowledgeInputSchema, input);
  await callModuleRpc(
    context,
    'patrol_handover_acknowledge',
    {
      p_society_id: societyId,
      p_note_id: values.noteId,
      p_request_id: context.requestId,
    },
    z.null(),
    'You cannot acknowledge your own handover note.',
  );
}
