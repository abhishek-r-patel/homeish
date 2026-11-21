// Authorize the P43.2 monthly collection report and the P43.3 admin dues follow-up list, and audit their exports.
import 'server-only';
import { z } from 'zod';
import {
  reportPeriodRange,
  type ReportPeriod,
} from '../analytics/report-period';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  billingDuesFollowUpSchema,
  billingMonthlyCollectionExportInputSchema,
  billingMonthlyCollectionSchema,
} from './collection-validation';
import { todayInTimeZone } from './format';

type CollectionPermission =
  | 'billing:charges:read'
  | 'billing:monthly_report:export'
  | 'billing:dues_follow_up:read';

async function getContext(
  permission: CollectionPermission,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'billing', permission, write: false });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

async function loadMonthlyCollection(
  context: Awaited<ReturnType<typeof getContext>>['context'],
  societyId: string,
  period: ReportPeriod,
  timezone: string,
) {
  const range = reportPeriodRange(period, todayInTimeZone(timezone));
  const result = await callModuleRpc(
    context,
    'billing_monthly_collection',
    {
      p_society_id: societyId,
      p_from_month: range.from,
      p_to_month: range.toMonth,
    },
    billingMonthlyCollectionSchema,
    'The monthly collection report could not be loaded.',
  );
  return { ...result, period, range };
}

export async function getBillingMonthlyCollection(
  period: ReportPeriod,
  timezone: string,
) {
  const { context, societyId } = await getContext('billing:charges:read');
  return loadMonthlyCollection(context, societyId, period, timezone);
}

export async function exportBillingMonthlyCollection(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'billing:monthly_report:export',
    requestId,
  );
  const { period } = parseModuleInput(
    billingMonthlyCollectionExportInputSchema,
    input,
  );
  await enforceRateLimit(
    'exportsUserHourly',
    context.userId,
    context.requestId,
  );
  const timezone = await getSocietyTimezone(context, societyId);
  const range = reportPeriodRange(period, todayInTimeZone(timezone));
  await callModuleRpc(
    context,
    'billing_monthly_collection_export_record',
    {
      p_society_id: societyId,
      p_from_month: range.from,
      p_to_month: range.toMonth,
      p_request_id: context.requestId,
    },
    z.null(),
    'The monthly collection export is invalid. Refresh and retry.',
  );
  return loadMonthlyCollection(context, societyId, period, timezone);
}

async function getSocietyTimezone(
  context: Awaited<ReturnType<typeof getContext>>['context'],
  societyId: string,
) {
  const { data, error } = await context.db
    .from('societies')
    .select('timezone')
    .eq('id', societyId)
    .single();
  if (error) throw new Error('The society time zone could not be loaded.');
  return data.timezone;
}

// Every view and every export is audited in the database call itself, with the row count only.
export async function getBillingDuesFollowUp(
  purpose: 'view' | 'export' = 'view',
  requestId = createRequestId(),
) {
  const { context, societyId } = await getContext(
    'billing:dues_follow_up:read',
    requestId,
  );
  if (purpose === 'export') {
    await enforceRateLimit(
      'exportsUserHourly',
      context.userId,
      context.requestId,
    );
  }
  return callModuleRpc(
    context,
    'billing_dues_follow_up',
    {
      p_society_id: societyId,
      p_purpose: purpose,
      p_request_id: context.requestId,
    },
    billingDuesFollowUpSchema,
    'The dues follow-up list could not be loaded.',
  );
}
