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
export const SERVICE_REQUEST_PRIORITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const;
export const serviceRequestPrioritySchema = z.enum(SERVICE_REQUEST_PRIORITIES);
export const SERVICE_REQUEST_INTAKE_SOURCES = [
  'walk_in',
  'phone',
  'whatsapp',
  'email',
  'helpdesk_app',
  'daily_rounds',
] as const;
export const serviceRequestIntakeSourceSchema = z.enum(
  SERVICE_REQUEST_INTAKE_SOURCES,
);
const score = z.number().int().min(1).max(5);

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
  committee_escalation_days: z.number().int().min(1).max(30),
});

export const DEFAULT_COMMITTEE_ESCALATION_DAYS = 2;

export const serviceRequestCategoryInputSchema = z
  .object({
    id: uuid.nullable(),
    name: z.string().trim().min(2).max(80),
    slaHours: z.number().int().min(1).max(8760).nullable(),
    committeeEscalationDays: z.number().int().min(1).max(30).optional(),
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
  on_hold_since: timestamp.nullable(),
  on_hold_reason: z.string().nullable(),
  held_seconds: z.number().int().nonnegative(),
  rating_quality: score.nullable(),
  rating_speed: score.nullable(),
  rating_behaviour: score.nullable(),
  feedback_follow_up: z.enum(['needed', 'done']).nullable(),
  intake_source: serviceRequestIntakeSourceSchema,
  assigned_vendor_id: uuid.nullable(),
});

export const serviceRequestSummarySchema = serviceRequestSchema.extend({
  category_name: z.string(),
  unit_number: z.string().nullable(),
  requester_name: z.string().nullable(),
  assignee_name: z.string().nullable(),
  is_overdue: z.boolean(),
  upvote_count: z.number().int().nonnegative(),
  has_upvoted: z.boolean(),
  escalation_level: z.enum(['none', 'admin', 'committee']),
  held_days: z.number().int().nonnegative().nullable(),
});

export const serviceRequestEscalationDeliverySchema = z.enum([
  'in_app',
  'in_app_email',
]);

export const serviceRequestCommitteeWaitModeSchema = z.enum([
  'per_category',
  'per_priority',
]);
const committeeWait = z.number().int().min(1).max(30);
const committeeWaitsSchema = z
  .object({
    critical: committeeWait,
    high: committeeWait,
    medium: committeeWait,
    low: committeeWait,
  })
  .strict();

export const serviceRequestEscalationSettingsSchema = z.object({
  delivery: serviceRequestEscalationDeliverySchema,
  committee_wait_mode: serviceRequestCommitteeWaitModeSchema,
  committee_waits: committeeWaitsSchema,
  updated_at: timestamp.nullable(),
});

export const serviceRequestEscalationSettingsInputSchema = z
  .object({
    delivery: serviceRequestEscalationDeliverySchema,
    committeeWaitMode: serviceRequestCommitteeWaitModeSchema.optional(),
    committeeWaits: committeeWaitsSchema.nullable().optional(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict();

export const serviceRequestEscalationRunSchema = z.object({
  admin: z.number().int().nonnegative(),
  committee: z.number().int().nonnegative(),
  emails: z.array(
    z.object({
      email: z.string(),
      name: z.string().nullable(),
      level: z.enum(['admin', 'committee']),
      request_id: uuid,
      request_label: z.string(),
    }),
  ),
});

export const serviceRequestUpvoteInputSchema = z
  .object({ requestId: uuid, upvoted: z.boolean() })
  .strict();
export const serviceRequestUpvoteSchema = z.object({
  request_id: uuid,
  upvote_count: z.number().int().nonnegative(),
  has_upvoted: z.boolean(),
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
    'escalated',
    'priority_changed',
    'held',
    'released',
  ]),
  from_status: serviceRequestStatusSchema.nullable(),
  to_status: serviceRequestStatusSchema.nullable(),
  note: z.string().nullable(),
  actor_name: z.string().nullable().optional(),
});

export const serviceRequestEscalationResponseStatusSchema = z.enum([
  'pending_response',
  'action_taken',
  'resolved',
  'further_escalated',
]);

export const serviceRequestEscalationStepSchema = z.object({
  level: z.enum(['admin', 'committee']),
  escalated_on: z.iso.date(),
  response_status: serviceRequestEscalationResponseStatusSchema,
  responded_at: timestamp.nullable(),
  responder_name: z.string().nullable(),
  response_note: z.string().nullable(),
  days_to_respond: z.number().int().nullable(),
});

export const serviceRequestDetailSchema = z.object({
  request: serviceRequestSummarySchema,
  comments: z.array(serviceRequestCommentSchema),
  attachments: z.array(serviceRequestAttachmentSchema),
  events: z.array(serviceRequestEventSchema),
  escalations: z.array(serviceRequestEscalationStepSchema),
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

export const serviceRequestLogInputSchema = z
  .object({
    categoryId: uuid,
    locationType: z.enum(['unit', 'common_area']),
    unitId: uuid.nullable(),
    description: z.string().trim().min(1).max(2000),
    priority: serviceRequestPrioritySchema,
    intakeSource: serviceRequestIntakeSourceSchema,
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
    vendorId: uuid.nullable().optional(),
    vendorName: z.string().trim().max(120).nullable(),
    vendorPhone: z.string().trim().max(20).nullable(),
    note: z.string().trim().max(500).nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    const isMember = input.membershipId !== null;
    const isListedVendor = Boolean(input.vendorId);
    const isVendor = input.vendorName !== null || input.vendorPhone !== null;
    if ([isMember, isListedVendor, isVendor].filter(Boolean).length !== 1) {
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
    rating: score,
    comment: z.string().trim().max(500).nullable(),
    quality: score.nullable().optional(),
    speed: score.nullable().optional(),
    behaviour: score.nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const given = [input.quality, input.speed, input.behaviour].filter(
      (value) => value !== null && value !== undefined,
    ).length;
    if (given !== 0 && given !== 3) {
      context.addIssue({
        code: 'custom',
        path: ['quality'],
        message: 'Rate all three details, or leave all three empty.',
      });
    }
  });
export const serviceRequestPriorityChangeInputSchema = z
  .object({
    requestId: uuid,
    priority: serviceRequestPrioritySchema,
    reason: z.string().trim().min(2).max(400),
  })
  .strict();
export const serviceRequestHoldInputSchema = z
  .object({ requestId: uuid, reason: z.string().trim().min(1).max(500) })
  .strict();
export const serviceRequestFollowUpInputSchema = z
  .object({ requestId: uuid, followUp: z.enum(['needed', 'done']).nullable() })
  .strict();
const targetDays = z.number().int().min(1).max(365);
export const serviceRequestTargetsInputSchema = z
  .object({
    categoryId: uuid,
    targets: z
      .object({
        critical: targetDays,
        high: targetDays,
        medium: targetDays,
        low: targetDays,
      })
      .strict()
      .nullable(),
  })
  .strict();
export const serviceRequestTargetSchema = z.object({
  category_id: uuid,
  priority: serviceRequestPrioritySchema,
  target_days: z.number().int(),
});
export const serviceRequestEscalationRespondInputSchema = z
  .object({
    requestId: uuid,
    level: z.enum(['admin', 'committee']),
    responseStatus: z.enum(['action_taken', 'resolved', 'further_escalated']),
    note: z.string().trim().max(1000).nullable(),
  })
  .strict();
export const serviceRequestCommentInputSchema = z
  .object({
    requestId: uuid,
    body: z.string().trim().min(1).max(2000),
    clientRequestId: uuid,
  })
  .strict();

const nullableNumber = z.number().nullable();
const reportRowSchema = z.object({
  logged: z.number().int(),
  resolved: z.number().int(),
  avg_days: nullableNumber,
});
export const serviceRequestReportSchema = z.object({
  from_month: z.string(),
  totals: z.object({
    logged: z.number().int(),
    rejected: z.number().int(),
    resolved: z.number().int(),
    with_target: z.number().int(),
    on_time: z.number().int(),
    avg_days: nullableNumber,
  }),
  by_category: z.array(reportRowSchema.extend({ category: z.string() })),
  by_priority: z.array(
    reportRowSchema.extend({ priority: serviceRequestPrioritySchema }),
  ),
  by_month: z.array(
    reportRowSchema.extend({
      month: z.string(),
      closing_backlog: z.number().int(),
    }),
  ),
  open_load: z.array(
    z.object({ assignee: z.string().nullable(), open: z.number().int() }),
  ),
  unassigned_open: z.number().int(),
  repeats: z
    .array(
      z.object({
        category: z.string(),
        unit_number: z.string(),
        count: z.number().int(),
      }),
    )
    .nullable(),
  feedback: z.object({
    rated: z.number().int(),
    avg_overall: nullableNumber,
    avg_quality: nullableNumber,
    avg_speed: nullableNumber,
    avg_behaviour: nullableNumber,
    follow_up_needed: z.number().int(),
  }),
  comments: z
    .array(
      z.object({
        request_id: uuid,
        category: z.string(),
        rating: z.number().int(),
        comment: z.string(),
        follow_up: z.enum(['needed', 'done']).nullable(),
        closed_at: timestamp.nullable(),
      }),
    )
    .nullable(),
});

export const serviceRequestInspectionPointSchema = z.object({
  id: uuid,
  name: z.string(),
  location_note: z.string().nullable(),
  sort_order: z.number().int(),
  active: z.boolean(),
  updated_at: timestamp,
});
export const serviceRequestRoundsTodaySchema = z.object({
  check_date: z.iso.date(),
  points: z.array(
    serviceRequestInspectionPointSchema.extend({
      check: z
        .object({
          result: z.enum(['ok', 'issue']),
          note: z.string().nullable(),
          request_id: uuid.nullable(),
          checked_by_name: z.string().nullable(),
          created_at: timestamp,
        })
        .nullable(),
    }),
  ),
});
export const serviceRequestRoundCheckSchema = z.object({
  id: uuid,
  point_id: uuid,
  check_date: z.iso.date(),
  result: z.enum(['ok', 'issue']),
  request_id: uuid.nullable(),
});
export const serviceRequestRoundsReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  totals: z.object({
    checks: z.number().int(),
    ok: z.number().int(),
    issues: z.number().int(),
    ok_pct: nullableNumber,
  }),
  points: z.array(
    z.object({
      point_id: uuid,
      name: z.string(),
      checks: z.number().int(),
      issues: z.number().int(),
    }),
  ),
});
export const serviceRequestIntakeOptionsSchema = z.object({
  categories: z.array(z.object({ id: uuid, name: z.string() })),
  open_common_requests: z.array(
    z.object({
      id: uuid,
      category: z.string(),
      summary: z.string(),
      created_at: timestamp,
    }),
  ),
});
export const serviceRequestInspectionPointInputSchema = z
  .object({
    id: uuid.nullable(),
    name: z.string().trim().min(1).max(120),
    locationNote: z.string().trim().max(200).nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    active: z.boolean(),
  })
  .strict();
export const serviceRequestRoundCheckInputSchema = z
  .object({
    pointId: uuid,
    result: z.enum(['ok', 'issue']),
    note: z.string().trim().max(500).nullable(),
    action: z.enum(['none', 'raise', 'link']),
    categoryId: uuid.nullable(),
    priority: serviceRequestPrioritySchema.nullable(),
    linkRequestId: uuid.nullable(),
    clientRequestId: uuid,
  })
  .strict()
  .superRefine((input, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (input.result === 'issue' && !input.note) {
      issue('note', 'Describe the issue.');
    }
    if (input.result === 'ok' && input.action !== 'none') {
      issue('action', 'Only an Issue can raise or link a request.');
    }
    if ((input.action === 'raise') !== (input.categoryId !== null)) {
      issue('categoryId', 'Choose a category to raise a request.');
    }
    if ((input.action === 'link') !== (input.linkRequestId !== null)) {
      issue('linkRequestId', 'Choose an open request to link.');
    }
    if (input.priority !== null && input.action !== 'raise') {
      issue('priority', 'Priority applies only to a raised request.');
    }
  });

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
export type ServiceRequestEscalationLevel =
  ServiceRequestSummary['escalation_level'];
export type ServiceRequestEscalationDelivery = z.infer<
  typeof serviceRequestEscalationDeliverySchema
>;
export type ServiceRequestEscalationSettings = z.infer<
  typeof serviceRequestEscalationSettingsSchema
>;
export type ServiceRequestEscalationStep = z.infer<
  typeof serviceRequestEscalationStepSchema
>;
export type ServiceRequestReport = z.infer<typeof serviceRequestReportSchema>;
export type ServiceRequestRoundsToday = z.infer<
  typeof serviceRequestRoundsTodaySchema
>;
export type ServiceRequestRoundsReport = z.infer<
  typeof serviceRequestRoundsReportSchema
>;
export type ServiceRequestIntakeOptions = z.infer<
  typeof serviceRequestIntakeOptionsSchema
>;
export type ServiceRequestIntakeSource = z.infer<
  typeof serviceRequestIntakeSourceSchema
>;
export type ServiceRequestTarget = z.infer<typeof serviceRequestTargetSchema>;
