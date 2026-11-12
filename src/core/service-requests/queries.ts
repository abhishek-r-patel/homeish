// Read service request data through permission-checked, schema-validated RPCs.
import 'server-only';
import { z } from 'zod';
import { AppError, CONFLICT_REASONS, ValidationError } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import {
  serviceRequestAssigneeSchema,
  serviceRequestCategorySchema,
  serviceRequestDashboardSchema,
  serviceRequestDetailSchema,
  serviceRequestSummarySchema,
  serviceRequestSettingsSchema,
} from './validation';

const requestListSchema = z.array(serviceRequestSummarySchema);

export async function serviceRequestRpc<T>(
  context: RequestContext,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  let result: unknown;
  try {
    result = await invokeUntypedRpc<unknown>(context.db, name, args);
  } catch (error) {
    const cause = z
      .object({
        code: z.string().optional(),
        hint: z.string().nullish(),
      })
      .safeParse(error instanceof Error ? error.cause : null);
    const code = cause.success ? cause.data.code : undefined;
    if (code === '42501') throw new AppError('FORBIDDEN');
    if (code === 'P0002') throw new AppError('NOT_FOUND');
    if (code === '23505') {
      const hint = cause.success ? cause.data.hint : undefined;
      const reason =
        hint === 'stale_record'
          ? 'stale_version'
          : (CONFLICT_REASONS.find((candidate) => candidate === hint) ??
            'invalid_state');
      throw new AppError('CONFLICT', {
        reason,
        message:
          reason === 'stale_version'
            ? 'This request changed in another session. Refresh and retry.'
            : 'This request can no longer be changed in its current state.',
      });
    }
    if (code === '22023' || code === '23514' || code === '23502') {
      throw new ValidationError({
        form: 'Check the request details and try again.',
      });
    }
    throw new Error('The service request database operation failed.', {
      cause: { code: code ?? 'unknown' },
    });
  }
  return schema.parse(result);
}

function requireSociety(context: RequestContext, societyId: string) {
  if (context.societyId !== societyId) throw new AppError('FORBIDDEN');
}

export async function readServiceRequestCategories(
  context: RequestContext,
  societyId: string,
  includeInactive = false,
) {
  requireSociety(context, societyId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission: 'request:list',
  });
  return serviceRequestRpc(
    context,
    'request_categories_list',
    {
      p_society_id: societyId,
      p_include_inactive: includeInactive,
    },
    z.array(serviceRequestCategorySchema),
  );
}

export type ServiceRequestListFilters = {
  status?: string;
  categoryId?: string;
  unitId?: string;
  assigneeId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export async function readServiceRequests(
  context: RequestContext,
  societyId: string,
  filters: ServiceRequestListFilters = {},
) {
  requireSociety(context, societyId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission: 'request:list',
  });
  return serviceRequestRpc(
    context,
    'request_list',
    {
      p_society_id: societyId,
      p_status: filters.status ?? null,
      p_category_id: filters.categoryId ?? null,
      p_unit_id: filters.unitId ?? null,
      p_assignee_id: filters.assigneeId ?? null,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    },
    requestListSchema,
  );
}

export async function readServiceRequest(
  context: RequestContext,
  societyId: string,
  requestId: string,
) {
  requireSociety(context, societyId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission: 'request:list',
  });
  return serviceRequestRpc(
    context,
    'request_get',
    { p_society_id: societyId, p_request_id: requestId },
    serviceRequestDetailSchema,
  );
}

export async function readServiceRequestAssignees(
  context: RequestContext,
  societyId: string,
) {
  requireSociety(context, societyId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission: 'request:assignees:list',
  });
  return serviceRequestRpc(
    context,
    'request_assignees_list',
    { p_society_id: societyId },
    z.array(serviceRequestAssigneeSchema),
  );
}

export async function readServiceRequestDashboard(
  context: RequestContext,
  societyId: string,
) {
  requireSociety(context, societyId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission: 'request:report',
  });
  return serviceRequestRpc(
    context,
    'request_dashboard',
    { p_society_id: societyId },
    serviceRequestDashboardSchema,
  );
}

export async function readServiceRequestSettings(
  context: RequestContext,
  societyId: string,
) {
  requireSociety(context, societyId);
  const { data, error } = await context.db
    .from('module_configs')
    .select('settings')
    .eq('society_id', societyId)
    .eq('module_key', 'service_request')
    .single();
  if (error || !data) {
    throw new Error('Service request settings could not be loaded.', {
      cause: error,
    });
  }
  return serviceRequestSettingsSchema.parse(data.settings);
}
