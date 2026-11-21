// Authorize and load the P43.5 meeting and committee summary for admins and committee members.
import 'server-only';
import {
  reportPeriodRange,
  type ReportPeriod,
} from '../analytics/report-period';
import { todayInTimeZone } from '../billing/format';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { meetingGovernanceSummarySchema } from './summary-validation';

export async function getMeetingGovernanceSummary(period: ReportPeriod) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'meeting',
    permission: 'meeting:list',
  });
  const societyId = context.societyId;
  if (!societyId) throw new AppError('FORBIDDEN');
  const { data, error } = await context.db
    .from('societies')
    .select('timezone')
    .eq('id', societyId)
    .single();
  if (error) throw new Error('The society time zone could not be loaded.');
  const range = reportPeriodRange(period, todayInTimeZone(data.timezone));
  const summary = await callModuleRpc(
    context,
    'meeting_governance_summary',
    { p_society_id: societyId, p_from: range.from, p_to: range.to },
    meetingGovernanceSummarySchema,
    'The meeting summary could not be loaded.',
  );
  return { ...summary, period };
}
