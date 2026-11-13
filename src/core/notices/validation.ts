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

export const noticeAudienceSchema = z.enum(['all', 'blocks', 'owners']);
export type NoticeAudience = z.infer<typeof noticeAudienceSchema>;

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
  status: z.enum(['published', 'withdrawn']),
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

export const noticeViewSchema = z.enum(['current', 'archive']);
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
