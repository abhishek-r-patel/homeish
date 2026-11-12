// Shared service request contracts for database results and form inputs.
import { z } from 'zod';

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });

export const serviceRequestSettingsSchema = z
  .object({ auto_close_days: z.number().int().min(1).max(30).optional() })
  .strict();

export const DEFAULT_SERVICE_REQUEST_SETTINGS = {
  auto_close_days: 3,
} satisfies Required<z.infer<typeof serviceRequestSettingsSchema>>;

export const serviceRequestStatusSchema = z.enum([
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
  'reopened',
]);
export const serviceRequestPrioritySchema = z.enum(['normal', 'urgent']);

export const serviceRequestCategorySchema = z.object({
  id: uuid,
  society_id: uuid,
  created_at: timestamp,
  created_by: uuid.nullable(),
  updated_at: timestamp,
  updated_by: uuid.nullable(),
  name: z.string(),
  sla_hours: z.number().int().nullable(),
  sort_order: z.number().int(),
  active: z.boolean(),
});

export const serviceRequestCategoryInputSchema = z
  .object({
    id: uuid.nullable(),
    name: z.string().trim().min(2).max(80),
    slaHours: z.number().int().min(1).max(8760).nullable(),
    sortOrder: z.number().int().min(0).max(10000),
    active: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.id === null) !== (input.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Reload this category before saving changes.',
      });
    }
  });

export const serviceRequestSchema = z.object({
  id: uuid,
  society_id: uuid,
  created_at: timestamp,
  created_by: uuid,
  updated_at: timestamp,
  updated_by: uuid.nullable(),
  category_id: uuid,
  location_type: z.enum(['unit', 'common_area']),
  unit_id: uuid.nullable(),
  description: z.string(),
  priority: serviceRequestPrioritySchema,
  status: serviceRequestStatusSchema,
  assigned_membership_id: uuid.nullable(),
  assigned_vendor_name: z.string().nullable(),
  assigned_vendor_phone: z.string().nullable(),
  sla_due_at: timestamp.nullable(),
  resolved_at: timestamp.nullable(),
  closed_at: timestamp.nullable(),
  reject_reason: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  rating_comment: z.string().nullable(),
  client_request_id: uuid,
});

export const serviceRequestSummarySchema = serviceRequestSchema.extend({
  category_name: z.string(),
  unit_number: z.string().nullable(),
  requester_name: z.string().nullable(),
  assignee_name: z.string().nullable(),
  is_overdue: z.boolean(),
});

export const serviceRequestCommentSchema = z.object({
  id: uuid,
  society_id: uuid,
  created_at: timestamp,
  created_by: uuid,
  request_id: uuid,
  body: z.string(),
  client_request_id: uuid,
  author_name: z.string().nullable().optional(),
});

export const serviceRequestAttachmentSchema = z.object({
  id: uuid,
  society_id: uuid,
  created_at: timestamp,
  created_by: uuid,
  request_id: uuid,
  comment_id: uuid.nullable(),
  storage_path: z.string(),
  content_type: z.enum(['image/jpeg', 'image/png']),
  size_bytes: z.number().int(),
});

export const serviceRequestEventSchema = z.object({
  id: z.union([z.number().int(), z.string()]),
  society_id: uuid,
  created_at: timestamp,
  created_by: uuid.nullable(),
  request_id: uuid,
  event_type: z.enum([
    'created',
    'assigned',
    'reassigned',
    'status_changed',
    'rejected',
    'confirmed',
    'reopened',
    'rated',
    'commented',
    'auto_closed',
  ]),
  from_status: serviceRequestStatusSchema.nullable(),
  to_status: serviceRequestStatusSchema.nullable(),
  note: z.string().nullable(),
  actor_name: z.string().nullable().optional(),
});

export const serviceRequestDetailSchema = z.object({
  request: serviceRequestSummarySchema,
  comments: z.array(serviceRequestCommentSchema),
  attachments: z.array(serviceRequestAttachmentSchema),
  events: z.array(serviceRequestEventSchema),
});

export const serviceRequestAssigneeSchema = z.object({
  membership_id: uuid,
  user_id: uuid,
  name: z.string().nullable(),
  roles: z.array(z.string()),
});

export const serviceRequestDashboardSchema = z.object({
  total_open: z.number().int(),
  overdue: z.number().int(),
  by_status: z.record(z.string(), z.number().int()),
  by_category: z.array(
    z.object({
      category_id: uuid,
      category: z.string(),
      total: z.number().int(),
      avg_resolution_hours: z.number().nullable(),
      avg_rating: z.number().nullable(),
    }),
  ),
});

const requestAttachmentInputSchema = z
  .object({ path: z.string().min(1).max(500) })
  .strict();

export const serviceRequestCreateInputSchema = z
  .object({
    categoryId: uuid,
    locationType: z.enum(['unit', 'common_area']),
    unitId: uuid.nullable(),
    description: z.string().trim().min(1).max(2000),
    priority: serviceRequestPrioritySchema,
    attachments: z.array(requestAttachmentInputSchema).max(3),
    clientRequestId: uuid,
  })
  .strict()
  .superRefine((input, context) => {
    if (
      (input.locationType === 'unit' && input.unitId === null) ||
      (input.locationType === 'common_area' && input.unitId !== null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['unitId'],
        message: 'Choose a unit only for a unit request.',
      });
    }
  });

export const serviceRequestAssignInputSchema = z
  .object({
    requestId: uuid,
    membershipId: uuid.nullable(),
    vendorName: z.string().trim().max(120).nullable(),
    vendorPhone: z.string().trim().max(20).nullable(),
    note: z.string().trim().max(500).nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    const isMember = input.membershipId !== null;
    const isVendor = input.vendorName !== null || input.vendorPhone !== null;
    if (isMember === isVendor) {
      context.addIssue({
        code: 'custom',
        path: ['membershipId'],
        message: 'Choose one member or vendor assignment.',
      });
    }
    if (isVendor) {
      if (!input.vendorName || input.vendorName.length < 1) {
        context.addIssue({
          code: 'custom',
          path: ['vendorName'],
          message: 'Enter the vendor name.',
        });
      }
      if (
        !input.vendorPhone ||
        !/^[+0-9][0-9 -]{6,19}$/.test(input.vendorPhone)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['vendorPhone'],
          message: 'Enter a valid vendor phone number.',
        });
      }
    }
  });

export const serviceRequestIdInputSchema = z
  .object({ requestId: uuid })
  .strict();
export const serviceRequestStatusInputSchema = z
  .object({
    requestId: uuid,
    status: z.enum(['in_progress', 'resolved']),
  })
  .strict();
export const serviceRequestReasonInputSchema = z
  .object({ requestId: uuid, reason: z.string().trim().min(2).max(500) })
  .strict();
export const serviceRequestRateInputSchema = z
  .object({
    requestId: uuid,
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).nullable(),
  })
  .strict();
export const serviceRequestCommentInputSchema = z
  .object({
    requestId: uuid,
    body: z.string().trim().min(1).max(2000),
    clientRequestId: uuid,
  })
  .strict();

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export type ServiceRequestSummary = z.infer<typeof serviceRequestSummarySchema>;
export type ServiceRequestCategory = z.infer<
  typeof serviceRequestCategorySchema
>;
export type ServiceRequestStatus = z.infer<typeof serviceRequestStatusSchema>;
export type ServiceRequestPriority = z.infer<
  typeof serviceRequestPrioritySchema
>;
export type ServiceRequestDashboard = z.infer<
  typeof serviceRequestDashboardSchema
>;
