// Validate D-85 unit handover templates, records, files and read models.
import { z } from 'zod';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const timestamp = z.iso.datetime({ offset: true });
const id = z.uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
export const UNIT_HANDOVER_EVENT_TYPES = [
  'tenant_move_in',
  'tenant_move_out',
  'owner_transfer',
  'standalone',
] as const;
export const UNIT_HANDOVER_RESPONSES = ['yes', 'no', 'not_applicable'] as const;
export const HANDOVER_FILE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;
export const handoverFilePathSchema = z
  .string()
  .regex(
    /^[0-9a-f-]{36}\/handovers\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|pdf)$/i,
  );
const templateItemInputSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(80),
  })
  .strict();

export const unitHandoverTemplateInputSchema = z
  .object({
    items: z.array(templateItemInputSchema).min(1).max(30),
    expectedVersion: z.number().int().nonnegative(),
    clientRequestId: id,
  })
  .strict()
  .refine(
    ({ items }) =>
      new Set(items.map(({ key }) => key.toLowerCase())).size === items.length,
    'Each checklist key must be unique.',
  );

export const unitHandoverCreateInputSchema = z
  .object({
    unitId: id,
    eventType: z.enum(UNIT_HANDOVER_EVENT_TYPES),
    moveId: id.nullable(),
    transferCaseId: id.nullable(),
    handoverOn: z.iso.date(),
    note: optionalText(1000),
    partyMembershipIds: z.array(id).max(50),
    clientRequestId: id,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.moveId && value.transferCaseId)
      context.addIssue({
        code: 'custom',
        path: ['transferCaseId'],
        message: 'Link one tenancy move or one owner-transfer case, not both.',
      });
    if (value.transferCaseId && value.eventType !== 'owner_transfer')
      context.addIssue({
        code: 'custom',
        path: ['transferCaseId'],
        message: 'Transfer cases are only for owner-transfer handovers.',
      });
    if (
      value.moveId &&
      !['tenant_move_in', 'tenant_move_out'].includes(value.eventType)
    )
      context.addIssue({
        code: 'custom',
        path: ['moveId'],
        message: 'Only move-in or move-out handovers can link a tenancy move.',
      });
  });

export const unitHandoverItemsInputSchema = z
  .object({
    handoverId: id,
    items: z
      .array(
        z
          .object({
            itemId: id,
            response: z.enum(UNIT_HANDOVER_RESPONSES),
            note: optionalText(300),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    reason: optionalText(500),
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    ({ items }) =>
      new Set(items.map(({ itemId }) => itemId)).size === items.length,
    'Answer each handover item only once.',
  );

export const unitHandoverReadingInputSchema = z
  .object({
    handoverId: id,
    readingId: id,
    clientRequestId: id,
  })
  .strict();

export const handoverFileUploadInputSchema = z
  .object({
    handoverId: id,
    contentType: z.enum(HANDOVER_FILE_CONTENT_TYPES),
    sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
  })
  .strict();

export const unitHandoverPhotoInputSchema = z
  .object({
    handoverId: id,
    path: handoverFilePathSchema,
    contentType: z.enum(HANDOVER_FILE_CONTENT_TYPES),
    sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
    clientRequestId: id,
  })
  .strict();

export const unitHandoverAcknowledgeInputSchema = z
  .object({ handoverId: id, note: optionalText(500) })
  .strict();

export const unitHandoverCloseInputSchema = z
  .object({
    handoverId: id,
    expectedVersion: z.number().int().positive(),
  })
  .strict();

const partySchema = z.object({
  membership_id: id,
  name: z.string(),
  role: z.enum(['owner', 'tenant', 'family', 'seller', 'buyer', 'party']),
  acknowledged_at: timestamp.nullable(),
  acknowledgement_note: z.string().nullable(),
});
const itemSchema = z.object({
  id,
  position: z.number().int().min(1).max(30),
  item_key: z.string(),
  label: z.string(),
  response: z.enum(UNIT_HANDOVER_RESPONSES).nullable(),
  note: z.string().nullable(),
});
const readingSchema = z.object({
  id,
  meter_type: z.string(),
  reading_value: z.number().nonnegative(),
  reading_date: z.iso.date(),
});
const photoSchema = z.object({
  id,
  path: z.string(),
  content_type: z.enum(HANDOVER_FILE_CONTENT_TYPES),
  size_bytes: z.number().int().positive().max(MAX_FILE_BYTES),
});

export const unitHandoverWorkspaceSchema = z.object({
  can_manage: z.boolean(),
  today: z.iso.date(),
  template: z.object({
    items: z.array(templateItemInputSchema),
    version: z.number().int().nonnegative(),
    updated_at: timestamp.nullable(),
  }),
  parties: z.array(
    z.object({
      membership_id: id,
      name: z.string().nullable(),
      role: z.enum(['owner', 'tenant', 'family']),
    }),
  ),
  moves: z.array(
    z.object({
      id,
      kind: z.enum(['move_in', 'move_out']),
      status: z.string(),
      label: z.string(),
    }),
  ),
  transfer_cases: z.array(
    z.object({
      id,
      stage: z.string(),
      label: z.string(),
    }),
  ),
  readings: z.array(readingSchema),
  handovers: z.array(
    z.object({
      id,
      event_type: z.enum(UNIT_HANDOVER_EVENT_TYPES),
      move_id: id.nullable(),
      transfer_case_id: id.nullable(),
      handover_on: z.iso.date(),
      status: z.enum(['open', 'closed']),
      note: z.string().nullable(),
      version: z.number().int().positive(),
      closed_at: timestamp.nullable(),
      created_at: timestamp,
      items: z.array(itemSchema),
      parties: z.array(partySchema),
      readings: z.array(readingSchema),
      photos: z.array(photoSchema),
      can_acknowledge: z.boolean(),
    }),
  ),
});
export type UnitHandoverWorkspace = z.infer<typeof unitHandoverWorkspaceSchema>;
