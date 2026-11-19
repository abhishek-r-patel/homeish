// Shared notice board contracts for database results and form inputs.
import { z } from 'zod';

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });

export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 5000;
export const NOTICE_BLOCKS_MAX = 50;
export const NOTICE_ATTACHMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const NOTICE_PREPARED_BY_MAX = 80;
export const NOTICE_DISPLAY_LOCATION_MAX = 120;
export const NOTICE_NEXT_ACTION_MAX = 200;

const isoDate = z.iso.date();

export const noticeAudienceSchema = z.enum(['all', 'blocks', 'owners']);
export type NoticeAudience = z.infer<typeof noticeAudienceSchema>;

export const noticePlanningStatusSchema = z.enum([
  'draft',
  'scheduled',
  'posted',
  'removed',
]);
export type NoticePlanningStatus = z.infer<typeof noticePlanningStatusSchema>;

export const noticePrioritySchema = z.enum(['high', 'medium', 'low']);
export type NoticePriority = z.infer<typeof noticePrioritySchema>;

export const noticePlanSchema = z.object({
  prepared_by: z.string().nullable(),
  display_location: z.string().nullable(),
  priority: noticePrioritySchema.nullable(),
  next_action: z.string().nullable(),
  next_action_on: isoDate.nullable(),
});
export type NoticePlan = z.infer<typeof noticePlanSchema>;

export const noticeSchema = z.object({
  id: uuid,
  society_id: uuid,
  created_at: timestamp,
  created_by: uuid,
  updated_at: timestamp,
  title: z.string(),
  body: z.string(),
  audience: noticeAudienceSchema,
  pinned: z.boolean(),
  expires_at: timestamp.nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'withdrawn']),
  scheduled_for: isoDate.nullable(),
  published_at: timestamp.nullable(),
  planning_status: noticePlanningStatusSchema,
  plan: noticePlanSchema.nullable(),
  edited_at: timestamp.nullable(),
  withdrawn_at: timestamp.nullable(),
  attachment_path: z.string().nullable(),
  attachment_content_type: z.enum(NOTICE_ATTACHMENT_CONTENT_TYPES).nullable(),
  attachment_size_bytes: z.number().int().positive().nullable(),
  author_name: z.string().nullable(),
  blocks: z.array(z.object({ id: uuid, name: z.string() })),
  is_expired: z.boolean(),
  has_read: z.boolean(),
  read_count: z.number().int().nonnegative().nullable(),
  can_manage: z.boolean(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticeDetailSchema = noticeSchema.extend({
  audience_count: z.number().int().nonnegative().optional(),
});
export type NoticeDetail = z.infer<typeof noticeDetailSchema>;

export const noticeListSchema = z.array(noticeSchema);

const noticeContentShape = {
  title: z
    .string()
    .trim()
    .min(1, 'Enter a title.')
    .max(NOTICE_TITLE_MAX, `Use at most ${NOTICE_TITLE_MAX} characters.`),
  body: z
    .string()
    .trim()
    .min(1, 'Enter the notice text.')
    .max(NOTICE_BODY_MAX, `Use at most ${NOTICE_BODY_MAX} characters.`),
  audience: noticeAudienceSchema,
  blockIds: z.array(uuid).max(NOTICE_BLOCKS_MAX).default([]),
  expiresAt: timestamp.nullable().default(null),
  attachmentPath: z.string().max(500).nullable().default(null),
};

function refineAudience(
  input: { audience: NoticeAudience; blockIds: string[] },
  context: z.RefinementCtx,
) {
  if (input.audience === 'blocks' && input.blockIds.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['blockIds'],
      message: 'Choose at least one block.',
    });
  }
  if (input.audience !== 'blocks' && input.blockIds.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['blockIds'],
      message: 'Blocks can be chosen only for a block audience.',
    });
  }
}

export const noticeCreateInputSchema = z
  .object({
    ...noticeContentShape,
    pinned: z.boolean().default(false),
    clientRequestId: uuid,
  })
  .strict()
  .superRefine(refineAudience);
export type NoticeCreateInput = z.input<typeof noticeCreateInputSchema>;

export const noticeUpdateInputSchema = z
  .object({
    ...noticeContentShape,
    noticeId: uuid,
    expectedUpdatedAt: timestamp,
  })
  .strict()
  .superRefine(refineAudience);
export type NoticeUpdateInput = z.input<typeof noticeUpdateInputSchema>;

export const noticePinInputSchema = z
  .object({ noticeId: uuid, pinned: z.boolean() })
  .strict();

export const noticeIdInputSchema = z.object({ noticeId: uuid }).strict();

/** Saves a draft (no posting day) or a scheduled notice; creating needs a client request id. */
export const noticeDraftInputSchema = z
  .object({
    ...noticeContentShape,
    pinned: z.boolean().default(false),
    scheduledFor: isoDate.nullable().default(null),
    noticeId: uuid.nullable().default(null),
    expectedUpdatedAt: timestamp.nullable().default(null),
    clientRequestId: uuid.nullable().default(null),
  })
  .strict()
  .superRefine((input, context) => {
    refineAudience(input, context);
    if (input.noticeId === null && input.clientRequestId === null) {
      context.addIssue({
        code: 'custom',
        path: ['form'],
        message: 'Reload the page and try again.',
      });
    }
    if (input.noticeId !== null && input.expectedUpdatedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['form'],
        message: 'Reload the page and try again.',
      });
    }
  });
export type NoticeDraftInput = z.input<typeof noticeDraftInputSchema>;

export const noticePublishInputSchema = z
  .object({ noticeId: uuid, expectedUpdatedAt: timestamp })
  .strict();

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null));
}

export const noticePlanInputSchema = z
  .object({
    noticeId: uuid,
    preparedBy: optionalText(NOTICE_PREPARED_BY_MAX),
    displayLocation: optionalText(NOTICE_DISPLAY_LOCATION_MAX),
    priority: noticePrioritySchema.nullable().default(null),
    nextAction: optionalText(NOTICE_NEXT_ACTION_MAX),
    nextActionOn: isoDate.nullable().default(null),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.nextActionOn !== null && input.nextAction === null) {
      context.addIssue({
        code: 'custom',
        path: ['nextAction'],
        message: 'Describe the next action for this date.',
      });
    }
  });
export type NoticePlanInput = z.input<typeof noticePlanInputSchema>;

export const noticeViewSchema = z.enum(['current', 'archive', 'planned']);
export type NoticeView = z.infer<typeof noticeViewSchema>;

const UUID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const NOTICE_FILE_PATH_PATTERN = new RegExp(
  `^(${UUID_PATTERN})/notices/(${UUID_PATTERN})/${UUID_PATTERN}\\.(jpg|png|pdf)$`,
);

/** Returns the upload folder of a notice file path in the society, or null. */
export function noticeFileFolder(
  path: string,
  societyId: string,
): string | null {
  const match = NOTICE_FILE_PATH_PATTERN.exec(path);
  if (!match || match[1] !== societyId) return null;
  return `${societyId}/notices/${match[2]}`;
}
