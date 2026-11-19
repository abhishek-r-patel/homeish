// Authorise P53 member contact log and communication dashboard operations and call their database contracts.
import 'server-only';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { getToolkitContext } from '../toolkit/operations';
import {
  communicationDashboardSchema,
  contactLogEntrySchema,
  contactLogPageSchema,
  contactLogSaveInputSchema,
  parseDashboardMonth,
  type ContactLogFilter,
} from './validation';

/** Current Asia/Kolkata calendar month as YYYY-MM. */
export function currentIndiaMonth(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(now);
}

/** Current Asia/Kolkata calendar date as YYYY-MM-DD. */
export function currentIndiaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export async function getContactLogs(filter: ContactLogFilter) {
  const { context, societyId } = await getToolkitContext('contact_log:manage');
  const page = await callModuleRpc(
    context,
    'member_contact_logs_get',
    {
      p_society_id: societyId,
      p_status: filter === 'all' ? null : filter,
    },
    contactLogPageSchema,
    'Could not load the contact log. Refresh and retry.',
  );
  return { ...page, currentUserId: context.userId };
}

export async function saveContactLog(input: unknown, requestId: string) {
  const values = parseModuleInput(contactLogSaveInputSchema, input);
  const { context, societyId } = await getToolkitContext(
    'contact_log:manage',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'member_contact_log_save',
    {
      p_society_id: societyId,
      p_log_id: values.logId,
      p_values: {
        contact_on: values.contactOn,
        follow_up_on: values.followUpOn,
        contact_type: values.contactType,
        channel: values.channel,
        direction: values.direction,
        status: values.status,
        summary: values.summary,
        unit_id: values.unitId,
        handled_by: values.handledBy,
        service_request_id: values.serviceRequestId,
      },
      p_expected_updated_at: values.expectedUpdatedAt,
      p_client_request_id: values.clientRequestId,
      p_request_trace: context.requestId,
    },
    contactLogEntrySchema,
    'Check the contact details and retry. The contact date cannot be in the future and the handler must be an admin or committee member.',
  );
}

export async function getCommunicationDashboard(month: unknown) {
  const { context, societyId } = await getToolkitContext('communication:read');
  const selected = parseDashboardMonth(month, currentIndiaMonth());
  return callModuleRpc(
    context,
    'communication_dashboard_get',
    { p_society_id: societyId, p_month: `${selected}-01` },
    communicationDashboardSchema,
    'Could not load the communication summary. Refresh and retry.',
  );
}
