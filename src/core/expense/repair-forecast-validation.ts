// Validate P40.9 repair forecast forms and database read models.
import { z } from 'zod';
import { nonnegativeRupeesSchema } from '../billing/validation';

const timestamp = z.iso.datetime({ offset: true });
const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);
const optionalYearSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return null;
    if (!/^\d{4}$/.test(value)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a four-digit year or leave it blank.',
      });
      return z.NEVER;
    }
    return Number(value);
  });
const inflationPercentSchema = z
  .string()
  .trim()
  .max(5)
  .transform((value, context) => {
    if (!/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/.test(value)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter inflation from 0 to 20 with up to two decimals.',
      });
      return z.NEVER;
    }
    const rate = Number(value);
    if (rate > 20) {
      context.addIssue({
        code: 'custom',
        message: 'Inflation cannot exceed 20%.',
      });
      return z.NEVER;
    }
    return Math.round(rate * 100);
  });
const money = z.number().int().safe().min(0);

export const EXPENSE_REPAIR_FORECAST_CATEGORIES = [
  'structure',
  'waterproofing',
  'painting',
  'lifts',
  'plumbing',
  'electrical',
  'fire_safety',
  'other',
] as const;

export const expenseRepairForecastItemInputSchema = z
  .object({
    itemId: z.uuid().nullable(),
    name: text(120),
    category: z.enum(EXPENSE_REPAIR_FORECAST_CATEGORIES),
    lastDoneYear: optionalYearSchema,
    cycleYears: z.coerce.number().int().min(1).max(50),
    manualNextDueYear: optionalYearSchema,
    currentCostRupees: nonnegativeRupeesSchema,
    inflationPercent: inflationPercentSchema,
    notes: optionalText(500),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.itemId === null) !== (value.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the forecast item before editing.',
      });
    }
    if ((value.lastDoneYear === null) === (value.manualNextDueYear === null)) {
      context.addIssue({
        code: 'custom',
        path: ['manualNextDueYear'],
        message:
          'Enter the last-done year or a manual next-due year, but not both.',
      });
    }
    const currentYear = new Date().getFullYear();
    if (
      value.lastDoneYear !== null &&
      (value.lastDoneYear < 1950 || value.lastDoneYear > currentYear)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lastDoneYear'],
        message: 'Enter a last-done year from 1950 through this year.',
      });
    }
    if (
      value.manualNextDueYear !== null &&
      (value.manualNextDueYear < 1950 ||
        value.manualNextDueYear > currentYear + 100)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['manualNextDueYear'],
        message: 'Enter a supported next-due year.',
      });
    }
  });

export const expenseRepairForecastArchiveInputSchema = z
  .object({
    itemId: z.uuid(),
    archive: z.boolean(),
    reason: optionalText(500),
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.archive && (!value.reason || value.reason.length < 5)) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason of at least 5 characters to archive the item.',
      });
    }
    if (!value.archive && value.reason !== null) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Do not enter an archive reason when restoring an item.',
      });
    }
  });

export const expenseRepairForecastFundInputSchema = z
  .object({
    gapFundId: z.uuid().nullable(),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict();

export const expenseRepairForecastYearSchema = z
  .object({
    financial_year: z.number().int().min(1900).max(2300),
    amount_paise: money,
  })
  .strict();
export const expenseRepairForecastItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    category: z.enum(EXPENSE_REPAIR_FORECAST_CATEGORIES),
    last_done_year: z.number().int().nullable(),
    cycle_years: z.number().int().min(1).max(50),
    manual_next_due_year: z.number().int().nullable(),
    current_cost_paise: money,
    inflation_bp: z.number().int().min(0).max(2000),
    notes: z.string().nullable(),
    archived_at: timestamp.nullable(),
    archive_reason: z.string().nullable(),
    updated_at: timestamp,
    next_due_year: z.number().int(),
    overdue: z.boolean(),
    years: z.array(expenseRepairForecastYearSchema).length(10),
    project_id: z.uuid().nullable(),
    project_title: z.string().nullable(),
  })
  .strict();
export const expenseRepairForecastSchema = z
  .object({
    today: z.iso.date(),
    financial_year_start: z.iso.date(),
    can_manage: z.boolean(),
    include_archived: z.boolean(),
    items: z.array(expenseRepairForecastItemSchema),
    years: z.array(
      z
        .object({
          financial_year: z.number().int().min(1900).max(2300),
          total_paise: money,
        })
        .strict(),
    ),
    gap_fund_id: z.uuid().nullable(),
    gap_fund_name: z.string().nullable(),
    gap_fund_balance_paise: money.nullable(),
    fund_balance_available: z.boolean(),
    settings_updated_at: timestamp.nullable(),
    funds: z.array(
      z.object({ id: z.uuid(), name: z.string().min(1) }).strict(),
    ),
  })
  .strict();

export type ExpenseRepairForecast = z.infer<typeof expenseRepairForecastSchema>;
export type ExpenseRepairForecastItem = z.infer<
  typeof expenseRepairForecastItemSchema
>;
