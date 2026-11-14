// Enforce module permissions, validate inputs and re-check request attachments.
import 'server-only';
import { z } from 'zod';
import { getRequestAmcLink } from '../amc/operations';
import { AppError, createRequestId, ValidationError } from '../errors';
import {
  FILE_CONTENT_TYPES,
  MAX_FILE_BYTES,
  verifyFileAttachment,
} from '../files/attachments';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import {
  readServiceRequest,
  readServiceRequestAssignees,
  readServiceRequestCategories,
  readServiceRequestDashboard,
  readServiceRequests,
  readServiceRequestSettings,
  serviceRequestRpc,
  type ServiceRequestListFilters,
} from './queries';
import {
  serviceRequestAssignInputSchema,
  serviceRequestCategoryInputSchema,
  serviceRequestCategorySchema,
  serviceRequestCommentInputSchema,
  serviceRequestCreateInputSchema,
  serviceRequestDetailSchema,
  serviceRequestIdInputSchema,
  serviceRequestReasonInputSchema,
  serviceRequestRateInputSchema,
  serviceRequestSchema,
  serviceRequestStatusInputSchema,
  serviceRequestUpvoteInputSchema,
  serviceRequestUpvoteSchema,
} from './validation';

type RequestPermission =
  | 'request:list'
  | 'request:create'
  | 'request:categories:manage'
  | 'request:assign'
  | 'request:update'
  | 'request:reject'
  | 'request:close'
  | 'request:rate'
  | 'request:comment'
  | 'request:assignees:list'
  | 'request:report'
  | 'request:upvote';

async function getContext(
  permission: RequestPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission,
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new ValidationError(
    Object.fromEntries(
      parsed.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

export async function getServiceRequestWorkspace(
  filters: ServiceRequestListFilters = {},
) {
  const { context, societyId } = await getContext('request:list');
  const categories = await readServiceRequestCategories(
    context,
    societyId,
    context.roles.includes('admin'),
  );
  const [requests, dashboard] = await Promise.all([
    readServiceRequests(context, societyId, filters),
    context.roles.some((role) => role === 'admin' || role === 'committee')
      ? readServiceRequestDashboard(context, societyId)
      : Promise.resolve(null),
  ]);
  return {
    categories,
    requests,
    dashboard,
    canManage: context.roles.includes('admin'),
    canUpvote: context.roles.includes('resident'),
    canReport: context.roles.some(
      (role) => role === 'admin' || role === 'committee',
    ),
  };
}

export async function getServiceRequestCreateOptions() {
  const { context, societyId } = await getContext('request:create');
  const [categoriesResult, occupantsResult] = await Promise.all([
    readServiceRequestCategories(context, societyId),
    context.db
      .from('unit_occupants')
      .select('unit_id')
      .eq('society_id', societyId)
      .eq('status', 'active'),
  ]);
  if (occupantsResult.error) {
    throw new Error('Could not load the units available for requests.', {
      cause: occupantsResult.error,
    });
  }
  const unitIds = [
    ...new Set(occupantsResult.data.map(({ unit_id }) => unit_id)),
  ];
  if (unitIds.length === 0) {
    return { categories: categoriesResult, units: [] };
  }
  const { data: units, error: unitsError } = await context.db
    .from('units')
    .select('id, number, block_id')
    .eq('society_id', societyId)
    .eq('active', true)
    .in('id', unitIds)
    .order('number');
  if (unitsError) {
    throw new Error('Could not load the units available for requests.', {
      cause: unitsError,
    });
  }
  const blockIds = [
    ...new Set(
      units
        .map(({ block_id }) => block_id)
        .filter((blockId): blockId is string => blockId !== null),
    ),
  ];
  const blocksResult =
    blockIds.length > 0
      ? await context.db
          .from('blocks')
          .select('id, name')
          .eq('society_id', societyId)
          .in('id', blockIds)
      : { data: [], error: null };
  if (blocksResult.error) {
    throw new Error('Could not load unit block names.', {
      cause: blocksResult.error,
    });
  }
  const blockNames = new Map(
    (blocksResult.data ?? []).map(({ id, name }) => [id, name]),
  );
  return {
    categories: categoriesResult,
    units: units.map(({ id, number, block_id }) => ({
      id,
      number,
      block: block_id ? (blockNames.get(block_id) ?? null) : null,
    })),
  };
}

export async function getServiceRequestDetail(requestId: string) {
  const { context, societyId } = await getContext('request:list');
  const detail = await readServiceRequest(context, societyId, requestId);
  const attachments = await Promise.all(
    detail.attachments.map(async (attachment) => {
      const { data, error } = await context.db.storage
        .from('request-files')
        .createSignedUrl(attachment.storage_path, 300);
      if (error || !data) {
        throw new Error('A request attachment could not be loaded.', {
          cause: error,
        });
      }
      return { ...attachment, signed_url: data.signedUrl };
    }),
  );
  const isRequester = detail.request.created_by === context.userId;
  const isAdmin = context.roles.includes('admin');
  let canUpdate = isAdmin;
  if (!canUpdate && detail.request.assigned_membership_id) {
    const { data: assignment, error: assignmentError } = await context.db
      .from('memberships')
      .select('id')
      .eq('id', detail.request.assigned_membership_id)
      .eq('user_id', context.userId)
      .eq('status', 'active')
      .maybeSingle();
    if (assignmentError) {
      throw new Error('Request assignment access could not be checked.', {
        cause: assignmentError,
      });
    }
    canUpdate = assignment !== null;
  }
  return {
    ...detail,
    attachments,
    amc: await getRequestAmcLink(context, societyId, requestId),
    capabilities: {
      canManage: isAdmin,
      canSeeAdminWorkspace: context.roles.some((role) =>
        ['admin', 'committee'].includes(role),
      ),
      canUpdate,
      canUpvote:
        context.roles.includes('resident') &&
        detail.request.location_type === 'common_area' &&
        !['closed', 'rejected'].includes(detail.request.status),
      isRequester,
    },
  };
}

export async function getServiceRequestCategories(includeInactive = false) {
  const { context, societyId } = await getContext('request:list');
  return readServiceRequestCategories(
    context,
    societyId,
    includeInactive && context.roles.includes('admin'),
  );
}

export async function getServiceRequestAssignees() {
  const { context, societyId } = await getContext('request:assignees:list');
  return readServiceRequestAssignees(context, societyId);
}

export async function getServiceRequestDashboard() {
  const { context, societyId } = await getContext('request:report');
  return readServiceRequestDashboard(context, societyId);
}

export async function getServiceRequestSettings() {
  const { context, societyId } = await getContext('request:list');
  return readServiceRequestSettings(context, societyId);
}

export async function saveServiceRequestCategory(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'request:categories:manage',
    true,
    requestId,
  );
  const category = parseInput(serviceRequestCategoryInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_category_save',
    {
      p_society_id: societyId,
      p_category_id: category.id,
      p_name: category.name,
      p_sla_hours: category.slaHours,
      p_sort_order: category.sortOrder,
      p_active: category.active,
      p_expected_updated_at: category.expectedUpdatedAt,
      p_request_id: context.requestId,
    },
    serviceRequestCategorySchema,
  );
}

export async function createServiceRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'request:create',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestCreateInputSchema, input);
  if (parsed.attachments.length > 3) {
    throw new ValidationError({
      attachments: 'A request can include at most three photos.',
    });
  }
  const attachments = await Promise.all(
    parsed.attachments.map(async ({ path }) => {
      const ownerPath = `${societyId}/${context.userId}/requests/${parsed.clientRequestId}`;
      const file = await verifyFileAttachment(context, {
        bucket: 'request-files',
        contentTypes: FILE_CONTENT_TYPES.filter(
          (type) => type === 'image/jpeg' || type === 'image/png',
        ),
        maxBytes: MAX_FILE_BYTES,
        ownerPath,
        path,
        societyId,
      });
      return {
        path,
        content_type: file.contentType,
        size_bytes: file.sizeBytes,
      };
    }),
  );
  return serviceRequestRpc(
    context,
    'request_create',
    {
      p_society_id: societyId,
      p_category_id: parsed.categoryId,
      p_location_type: parsed.locationType,
      p_unit_id: parsed.unitId,
      p_description: parsed.description,
      p_priority: parsed.priority,
      p_attachments: attachments,
      p_client_request_id: parsed.clientRequestId,
      p_request_id: context.requestId,
    },
    serviceRequestSchema,
    { retryOnDuplicate: true },
  );
}

export async function assignServiceRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'request:assign',
    true,
    requestId,
  );
  const assignment = parseInput(serviceRequestAssignInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_assign',
    {
      p_society_id: societyId,
      p_request_id: assignment.requestId,
      p_membership_id: assignment.membershipId,
      p_vendor_name: assignment.vendorName,
      p_vendor_phone: assignment.vendorPhone,
      p_note: assignment.note,
      p_request_trace: context.requestId,
    },
    serviceRequestSchema,
  );
}

export async function updateServiceRequestStatus(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'request:update',
    true,
    requestId,
  );
  const update = parseInput(serviceRequestStatusInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_update_status',
    {
      p_society_id: societyId,
      p_request_id: update.requestId,
      p_status: update.status,
      p_request_trace: context.requestId,
    },
    serviceRequestSchema,
  );
}

export async function rejectServiceRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'request:reject',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestReasonInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_reject',
    {
      p_society_id: societyId,
      p_request_id: parsed.requestId,
      p_reason: parsed.reason,
      p_request_trace: context.requestId,
    },
    serviceRequestSchema,
  );
}

export async function confirmServiceRequestClose(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'request:close',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestIdInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_confirm_close',
    {
      p_society_id: societyId,
      p_request_id: parsed.requestId,
      p_request_trace: context.requestId,
    },
    serviceRequestSchema,
  );
}

export async function reopenServiceRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'request:close',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestReasonInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_reopen',
    {
      p_society_id: societyId,
      p_request_id: parsed.requestId,
      p_reason: parsed.reason,
      p_request_trace: context.requestId,
    },
    serviceRequestSchema,
  );
}

export async function rateServiceRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'request:rate',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestRateInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_rate',
    {
      p_society_id: societyId,
      p_request_id: parsed.requestId,
      p_rating: parsed.rating,
      p_comment: parsed.comment,
      p_request_trace: context.requestId,
    },
    serviceRequestSchema,
  );
}

export async function addServiceRequestComment(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'request:comment',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestCommentInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_add_comment',
    {
      p_society_id: societyId,
      p_request_id: parsed.requestId,
      p_body: parsed.body,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: context.requestId,
    },
    serviceRequestDetailSchema.shape.comments.element,
  );
}

export async function setServiceRequestUpvote(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'request:upvote',
    true,
    requestId,
  );
  const parsed = parseInput(serviceRequestUpvoteInputSchema, input);
  return serviceRequestRpc(
    context,
    'request_upvote_set',
    {
      p_society_id: societyId,
      p_request_id: parsed.requestId,
      p_upvoted: parsed.upvoted,
      p_request_trace: context.requestId,
    },
    serviceRequestUpvoteSchema,
  );
}

export type { ServiceRequestListFilters };
