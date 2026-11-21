// Validate the unit records RPC and matching edit forms.
import { z } from 'zod';

const id = z.uuid();
const day = z.iso.date();
const version = z.coerce.number().int().min(0).max(2147483646);
const amount = z.preprocess(
  (value) => (value === '' ? null : value),
  z
    .string()
    .regex(/^\d{1,6}(\.\d{1,2})?$/)
    .refine((value) => Number(value) > 0)
    .nullable(),
);
const vacancyKind = z.enum(['vacant', 'locked']);
const reviewStatus = z.enum(['verified', 'remeasure']);
const nullableId = z.preprocess(
  (value) => (value === '' ? null : value),
  id.nullable(),
);
export const unitRecordEdit = z
  .discriminatedUnion('action', [
    z
      .object({
        action: z.literal('measure'),
        version,
        source: z.string().trim().min(1).max(120),
        carpet: amount,
        builtUp: amount,
        outdoor: amount,
      })
      .strict(),
    z
      .object({ action: z.literal('verify'), version, status: reviewStatus })
      .strict(),
    z
      .object({
        action: z.literal('vacancy'),
        version,
        id: nullableId,
        kind: vacancyKind,
        assignedTo: id,
        startsOn: day,
        followUpOn: day,
        inspectionOn: z.preprocess(
          (value) => (value === '' ? null : value),
          day.nullable(),
        ),
      })
      .strict(),
    z.object({ action: z.literal('close'), version, id }).strict(),
  ])
  .superRefine((edit, ctx) => {
    if (
      edit.action === 'measure' &&
      edit.carpet === null &&
      edit.builtUp === null &&
      edit.outdoor === null
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Enter at least one measured area.',
      });
    if (
      edit.action === 'vacancy' &&
      (edit.followUpOn < edit.startsOn ||
        (edit.inspectionOn !== null && edit.inspectionOn < edit.startsOn))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use dates on or after the vacancy start date.',
      });
  });

export const unitRecordsSchema = z
  .object({
    today: day,
    timezone: z.string().min(1),
    placement: z
      .object({
        block_id: id,
        block: z.string(),
        level: z.number().int(),
        label: z.string().nullable(),
        position: z.number().int(),
        duplex: z.boolean(),
      })
      .nullable(),
    admins: z.array(z.object({ id, name: z.string().nullable() })),
    areas: z.array(
      z.object({
        id,
        version: z.number().int(),
        source: z.string(),
        carpet_sqft: z.number().nullable(),
        built_up_sqft: z.number().nullable(),
        outdoor_sqft: z.number().nullable(),
        status: z.enum(['pending', 'verified', 'remeasure']),
        actor: z.string().nullable(),
        created_at: z.string(),
      }),
    ),
    followups: z.array(
      z.object({
        id,
        version: z.number().int(),
        kind: vacancyKind,
        starts_on: day,
        follow_up_on: day,
        inspection_on: day.nullable(),
        assigned_to: id,
        handler: z.string().nullable(),
        closed_at: z.string().nullable(),
      }),
    ),
  })
  .strict();
export type UnitRecords = z.infer<typeof unitRecordsSchema>;
