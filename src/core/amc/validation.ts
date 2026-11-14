// Validate AMC dates, private details, audited visit inputs and developer reminders.
import { z } from 'zod';
import { nonnegativeRupeesSchema } from '../billing/validation';

const timestamp = z.iso.datetime({ offset: true });
const text = (max: number) => z.string().trim().min(1).max(max);
export const amcSettingsSchema = z
  .object({
    expiring_soon_days: z.number().int().min(1).max(365).optional(),
    reminder_days: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(10)
      .refine(
        (days) => new Set(days).size === days.length,
        'Reminder days must be unique.',
      )
      .optional(),
  })
  .strict();
export const DEFAULT_AMC_SETTINGS = {
  expiring_soon_days: 30,
  reminder_days: [60, 30, 7],
};
export const amcContractInputSchema = z
  .object({
    contractId: z.uuid().nullable(),
    predecessorId: z.uuid().nullable(),
    assetLabel: text(120),
    vendorName: text(120),
    vendorContact: text(120),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    costRupees: nonnegativeRupeesSchema,
    paymentTerms: z.string().trim().max(1000),
    visitFrequency: text(120),
    documentPath: text(500).nullable(),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startDate > value.endDate)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date must not precede the start date.',
      });
    if ((value.contractId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the contract before editing.',
      });
  });
export const amcVisitInputSchema = z
  .object({
    contractId: z.uuid(),
    visitId: z.uuid().nullable(),
    visitDate: z.iso.date(),
    summary: text(2000),
    technician: text(120),
    documentPath: text(500).nullable(),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.visitId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the visit before editing.',
      });
  });
export const amcContractSchema = z.object({
  id: z.uuid(),
  asset_label: z.string(),
  vendor_name: z.string(),
  vendor_contact: z.string(),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  cost_paise: z.number().int().nonnegative().safe(),
  payment_terms: z.string(),
  visit_frequency: z.string(),
  document_path: z.string().nullable(),
  predecessor_id: z.uuid().nullable(),
  successor_id: z.uuid().nullable(),
  updated_at: timestamp,
  status: z.enum(['active', 'expiring', 'expired']),
});
export const amcVisitSchema = z.object({
  id: z.uuid(),
  contract_id: z.uuid(),
  visit_date: z.iso.date(),
  summary: z.string(),
  technician: z.string(),
  document_path: z.string().nullable(),
  updated_at: timestamp,
});
export const amcWorkspaceSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  contracts: z.array(amcContractSchema),
  visits: z.array(amcVisitSchema),
  links: z.array(z.object({ request_id: z.uuid(), contract_id: z.uuid() })),
});
export const amcRequestLinkSchema = z
  .object({
    requestId: z.uuid(),
    contractId: z.uuid().nullable(),
  })
  .strict();
export type AmcContract = z.infer<typeof amcContractSchema>;
export type AmcVisit = z.infer<typeof amcVisitSchema>;
