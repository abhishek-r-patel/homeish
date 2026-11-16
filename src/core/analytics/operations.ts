// Authorize committee analytics reads, settings changes and admin exports, and validate their RPC contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import {
  AppError,
  ConflictError,
  createRequestId,
  ValidationError,
} from '../errors';
import { hasPermission } from '../permissions';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import {
  analyticsExportInputSchema,
  analyticsRangeSchema,
  analyticsSettingsInputSchema,
  analyticsSettingsSchema,
  parseAnalyticsDashboard,
  type AnalyticsDashboard,
  type AnalyticsRange,
} from './validation';

type AnalyticsPermission =
  'analytics:read' | 'analytics:manage' | 'analytics:export';

export const ANALYTICS_SETTINGS_CONFLICT_MESSAGE =
  'Settings changed. Reload and try again.';

async function getContext(
  permission: AnalyticsPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'core', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

async function loadDashboard(
  context: RequestContext,
  societyId: string,
  range: AnalyticsRange,
): Promise<AnalyticsDashboard> {
  const raw = await callModuleRpc(
    context,
    'analytics_dashboard',
    {
      p_society_id: societyId,
      p_months: range.months,
      p_money_range: range.money,
    },
    z.unknown(),
    'Could not load analytics. Refresh and retry.',
  );
  return parseAnalyticsDashboard(raw, (key) => {
    context.logger.warn('analytics.metric_invalid', { metric: key });
  });
}

export async function getAnalyticsDashboard(range: unknown) {
  const { context, societyId } = await getContext('analytics:read');
  const values = parseModuleInput(analyticsRangeSchema, range);
  const dashboard = await loadDashboard(context, societyId, values);
  return {
    dashboard,
    canManage: hasPermission(context.roles, 'core', 'analytics:manage'),
    canExport: hasPermission(context.roles, 'core', 'analytics:export'),
  };
}

export async function getAnalyticsSettings() {
  const { context, societyId } = await getContext('analytics:manage');
  return callModuleRpc(
    context,
    'analytics_settings_get',
    { p_society_id: societyId },
    analyticsSettingsSchema,
    'Could not load analytics settings. Refresh and retry.',
  );
}

export async function updateAnalyticsSettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'analytics:manage',
    true,
    requestId,
  );
  await enforceRateLimit(
    'otherWritesUserMinute',
    context.userId,
    context.requestId,
  );
  const values = parseModuleInput(analyticsSettingsInputSchema, input);
  try {
    return await callModuleRpc(
      context,
      'analytics_settings_update',
      {
        p_society_id: societyId,
        p_metric_keys: values.metrics,
        p_expected_version: values.expectedVersion,
        p_request_id: context.requestId,
      },
      analyticsSettingsSchema,
      'Choose metrics from the list and try again.',
    );
  } catch (error) {
    if (error instanceof ConflictError) {
      throw new ConflictError(
        'stale_version',
        ANALYTICS_SETTINGS_CONFLICT_MESSAGE,
      );
    }
    if (error instanceof ValidationError) {
      throw new ValidationError(
        { metrics: 'Choose metrics from the list and try again.' },
        'Choose metrics from the list and try again.',
      );
    }
    throw error;
  }
}

async function getSocietyName(context: RequestContext, societyId: string) {
  const { data, error } = await context.db
    .from('societies')
    .select('name')
    .eq('id', societyId)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Could not load the society name.', { cause: error });
  }
  return data.name;
}

// Records the audited export first, then re-reads the live dashboard for the file.
export async function getAnalyticsExport(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'analytics:export',
    false,
    requestId,
  );
  const values = parseModuleInput(analyticsExportInputSchema, input);
  await enforceRateLimit(
    'exportsUserHourly',
    context.userId,
    context.requestId,
  );
  await callModuleRpc(
    context,
    'analytics_export_record',
    {
      p_society_id: societyId,
      p_format: values.format,
      p_months: values.months,
      p_money_range: values.money,
      p_request_id: context.requestId,
    },
    z.null(),
    'The analytics export is invalid. Refresh and retry.',
  );
  const [dashboard, societyName] = await Promise.all([
    loadDashboard(context, societyId, values),
    getSocietyName(context, societyId),
  ]);
  return { format: values.format, dashboard, societyName };
}
