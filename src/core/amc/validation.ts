// Validate AMC dates, private details, audited visit inputs and developer reminders.
import { z } from 'zod';
import { nonnegativeRupeesSchema } from '../billing/validation';

const timestamp = z.iso.datetime({ offset: true });
const text = (max: number) => z.string().trim().min(1).max(max);
export const amcSettingsSchema = z
  .object({
    due_soon_days: z.number().int().min(2).max(365).optional(),
    urgent_days: z.number().int().min(1).max(364).optional(),
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
  .strict()
  .superRefine((settings, context) => {
    if (
      (settings.due_soon_days === undefined) !==
      (settings.urgent_days === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['urgent_days'],
        message: 'Set both expiry windows.',
      });
    } else if (
      settings.due_soon_days !== undefined &&
      settings.urgent_days !== undefined &&
      settings.urgent_days >= settings.due_soon_days
    ) {
      context.addIssue({
        code: 'custom',
        path: ['urgent_days'],
        message: 'Urgent must be shorter than Due Soon.',
      });
    }
  });
export const DEFAULT_AMC_SETTINGS = {
  due_soon_days: 60,
  urgent_days: 30,
  reminder_days: [60, 30, 7],
};
export const amcExpirySettingsInputSchema = z
  .object({
    dueSoonDays: z.number().int().min(2).max(365),
    urgentDays: z.number().int().min(1).max(364),
  })
  .strict()
  .refine((settings) => settings.urgentDays < settings.dueSoonDays, {
    path: ['urgentDays'],
    message: 'Urgent must be shorter than Due Soon.',
  });
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
export const AMC_TYPES = ['comprehensive', 'non_comprehensive'] as const;
export const amcScheduleInputSchema = z
  .object({
    contractId: z.uuid(),
    amcType: z.enum(AMC_TYPES, 'Choose a valid AMC type.').nullable(),
    assetCategoryId: z.uuid('Choose a valid asset type.').nullable(),
    servicesPerYear: z
      .number('Services per year must be 1 to 12.')
      .int('Services per year must be 1 to 12.')
      .min(1, 'Services per year must be 1 to 12.')
      .max(12, 'Services per year must be 1 to 12.')
      .nullable(),
    expectedUpdatedAt: timestamp,
  })
  .strict();
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
  status: z.enum(['upcoming', 'active', 'due_soon', 'urgent', 'expired']),
  amc_type: z.enum(AMC_TYPES).nullable(),
  asset_category_id: z.uuid().nullable(),
  services_per_year: z.number().int().min(1).max(12).nullable(),
  asset_category_name: z.string().nullable(),
  last_visit_date: z.iso.date().nullable(),
  next_service_date: z.iso.date().nullable(),
  service_overdue: z.boolean(),
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
  settings: z
    .object({
      due_soon_days: z.number().int().min(2).max(365),
      urgent_days: z.number().int().min(1).max(364),
    })
    .strict(),
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
