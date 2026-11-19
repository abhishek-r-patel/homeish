// Authorise P35 society profile, adoption and committee action-plan operations and call their database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import {
  getMeetingAdminDetail,
  getMeetingAdminList,
} from '../meeting/operations';
import { authorizeRequest } from '../permissions/authorize';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  actionPlanArchiveInputSchema,
  actionPlanSampleInputSchema,
  actionPlanSaveInputSchema,
  actionPlansSchema,
  actionTaskSaveInputSchema,
  capabilityAdoptionResultSchema,
  capabilityAdoptionSaveInputSchema,
  capabilityAdoptionsSchema,
  societyProfileSaveInputSchema,
  societyProfileSchema,
  type MeetingActionOption,
  type ToolkitMemberOption,
} from './validation';

const MEETING_LINK_SOURCE_LIMIT = 10;

export async function getToolkitContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { permission, write });
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

// Society reference profile ----------------------------------------------------

export async function getSocietyProfile() {
  const { context, societyId } = await getToolkitContext(
    'society_profile:read',
  );
  return callModuleRpc(
    context,
    'society_reference_profile_get',
    { p_society_id: societyId },
    societyProfileSchema,
    'Could not load the society profile. Refresh and retry.',
  );
}

export async function saveSocietyProfile(input: unknown, requestId: string) {
  const values = parseModuleInput(societyProfileSaveInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'society_profile:manage',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'society_reference_profile_save',
    {
      p_society_id: societyId,
      p_values: values.values,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    societyProfileSchema,
    'Check the profile details and retry.',
  );
}

// Capability adoption ----------------------------------------------------------

export async function getCapabilityAdoptions() {
  const { context, societyId } = await getToolkitContext('adoption:read');
  return callModuleRpc(
    context,
    'society_capability_adoptions_get',
    { p_society_id: societyId },
    capabilityAdoptionsSchema,
    'Could not load capability adoption. Refresh and retry.',
  );
}

export async function saveCapabilityAdoption(
  input: unknown,
  requestId: string,
) {
  const values = parseModuleInput(capabilityAdoptionSaveInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'adoption:manage',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'society_capability_adoption_save',
    {
      p_society_id: societyId,
      p_module_key: values.moduleKey,
      p_status: values.status,
      p_priority: values.priority,
      p_owner_membership_id: values.ownerMembershipId,
      p_review_on: values.reviewOn,
      p_notes: values.notes,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    capabilityAdoptionResultSchema,
    'Check the adoption details and retry. The owner must be an active admin or committee member.',
  );
}

// Owner pickers ----------------------------------------------------------------

const memberRowsSchema = z.array(
  z.object({
    membership_id: z.uuid(),
    full_name: z.string().nullable(),
    email: z.string().nullable(),
    roles: z.array(z.string()),
    status: z.string(),
    unit_number: z.string().nullable(),
    block_name: z.string().nullable(),
  }),
);

/** Active members for owner pickers; one entry per membership even when it occupies several units. */
export async function getToolkitMemberOptions(): Promise<
  ToolkitMemberOption[]
> {
  const { context, societyId } = await getToolkitContext('membership:read');
  const { data, error } = await context.db.rpc('list_society_members', {
    p_society_id: societyId,
  });
  if (error) {
    if (error.code === '42501') throw new AppError('FORBIDDEN');
    throw new Error('Could not load society members.', { cause: error });
  }
  const options = new Map<string, ToolkitMemberOption>();
  for (const row of memberRowsSchema.parse(data ?? [])) {
    if (row.status !== 'active' || !row.full_name) continue;
    const existing = options.get(row.membership_id);
    const unit = row.unit_number
      ? [row.block_name, row.unit_number].filter(Boolean).join('-')
      : null;
    if (existing) {
      if (unit && !existing.label.includes(unit))
        existing.label = `${existing.label}, ${unit}`;
      continue;
    }
    options.set(row.membership_id, {
      membershipId: row.membership_id,
      label: unit ? `${row.full_name} · ${unit}` : row.full_name,
      manager: row.roles.includes('admin') || row.roles.includes('committee'),
    });
  }
  return [...options.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

/** Open meeting actions from recent held meetings; empty when Meetings is off or not visible. */
export async function getMeetingActionOptions(): Promise<
  MeetingActionOption[]
> {
  try {
    const list = await getMeetingAdminList('held');
    const details = await Promise.all(
      list.items
        .slice(0, MEETING_LINK_SOURCE_LIMIT)
        .map((meeting) => getMeetingAdminDetail(meeting.id)),
    );
    return details.flatMap((detail) =>
      detail.actions
        .filter((action) => action.status === 'open')
        .map((action) => ({
          id: action.id,
          label: `${action.title} · ${detail.meeting.title}`,
        })),
    );
  } catch (error) {
    if (error instanceof AppError) return [];
    throw error;
  }
}

// Committee action plans -------------------------------------------------------

export async function getActionPlans(includeArchived = false) {
  const { context, societyId } = await getToolkitContext('action_plan:own');
  return callModuleRpc(
    context,
    'committee_action_plans_get',
    { p_society_id: societyId, p_include_archived: includeArchived },
    actionPlansSchema,
    'Could not load action plans. Refresh and retry.',
  );
}

export async function saveActionPlan(input: unknown, requestId: string) {
  const values = parseModuleInput(actionPlanSaveInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'action_plan:manage',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'committee_action_plan_save',
    {
      p_society_id: societyId,
      p_plan_id: values.planId,
      p_name: values.name,
      p_start_on: values.startOn,
      p_notes: values.notes,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Check the plan details and retry. Archived plans cannot be edited.',
  );
}

export async function setActionPlanArchived(input: unknown, requestId: string) {
  const values = parseModuleInput(actionPlanArchiveInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'action_plan:manage',
    true,
    requestId,
  );
  await callModuleRpc(
    context,
    'committee_action_plan_set_archived',
    {
      p_society_id: societyId,
      p_plan_id: values.planId,
      p_archived: values.archived,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not change this plan. Refresh and retry.',
  );
  return values.archived;
}

export async function createSampleActionPlan(
  input: unknown,
  requestId: string,
) {
  const values = parseModuleInput(actionPlanSampleInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'action_plan:manage',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'committee_action_plan_create_sample',
    {
      p_society_id: societyId,
      p_name: values.name,
      p_start_on: values.startOn,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Could not create the sample plan. Check the details and retry.',
  );
}

export async function saveActionTask(input: unknown, requestId: string) {
  const values = parseModuleInput(actionTaskSaveInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'action_plan:manage',
    true,
    requestId,
  );
  const taskId = await callModuleRpc(
    context,
    'committee_action_plan_task_save',
    {
      p_society_id: societyId,
      p_task_id: values.taskId,
      p_plan_id: values.planId,
      p_title: values.title,
      p_category: values.category,
      p_priority: values.priority,
      p_owner_membership_id: values.ownerMembershipId,
      p_start_day: values.startDay,
      p_end_day: values.endDay,
      p_status: values.status,
      p_progress: values.progress,
      p_notes: values.notes,
      p_evidence_url: values.evidenceUrl,
      p_meeting_action_item_id: values.meetingActionItemId,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Check the task details and retry. A task linked to a meeting action is completed from the meeting, and archived plans cannot be edited.',
  );
  // A newly assigned owner gets an in-app notification; push delivery is best effort.
  await sendNotificationPushesForRequest(context.requestId);
  return taskId;
}
