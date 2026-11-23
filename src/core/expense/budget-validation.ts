// Validate P42.5 budget plans, approvals, changes and read models.
import { z } from 'zod';
import { nonnegativeRupeesSchema, rupeesSchema } from '../billing/validation';

const timestamp = z.iso.datetime({ offset: true });
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

export const EXPENSE_BUDGET_PHASINGS = [
  'equal_monthly',
  'quarterly',
  'half_yearly',
  'first_month',
  'custom',
] as const;
export type ExpenseBudgetPhasing = (typeof EXPENSE_BUDGET_PHASINGS)[number];

export const EXPENSE_BUDGET_INCOME_TYPES = [
  'billing',
  'donation',
  'interest',
  'other',
] as const;
export const EXPENSE_BUDGET_MONTHS = [
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'January',
  'February',
  'March',
] as const;

const percentBpSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === '') return null;
    if (!/^-?\d{1,3}(\.\d)?$/.test(value)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a percentage from -50 to +100 with up to one decimal.',
      });
      return z.NEVER;
    }
    const percent = Number(value);
    if (percent < -50 || percent > 100) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a percentage from -50 to +100.',
      });
      return z.NEVER;
    }
    return Math.round(percent * 10) * 10;
  });

export function spreadExpenseBudgetAmount(
  annualPaise: number,
  phasing: ExpenseBudgetPhasing,
  custom: readonly number[] | null = null,
) {
  if (phasing === 'custom') return [...(custom ?? [])];
  const slots =
    phasing === 'equal_monthly'
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : phasing === 'quarterly'
        ? [0, 3, 6, 9]
        : phasing === 'half_yearly'
          ? [0, 6]
          : [0];
  const amountUnits = annualPaise / 100;
  const baseUnits = Math.trunc(amountUnits / slots.length);
  const remainderUnits = amountUnits % slots.length;
  const months = Array.from({ length: 12 }, () => 0);
  for (const slot of slots) months[slot] = baseUnits * 100;
  months[slots.at(-1)!] += remainderUnits * 100;
  return months;
}

export const expenseBudgetFinancialYearSchema = z.coerce
  .number()
  .int()
  .min(2000)
  .max(2100);

const budgetHeadInputSchema = z
  .object({
    categoryId: z.uuid().nullable(),
    incomeType: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
    phasing: z.enum(EXPENSE_BUDGET_PHASINGS),
    annualRupees: nonnegativeRupeesSchema,
    monthRupees: z.array(nonnegativeRupeesSchema).length(12),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.categoryId === null) === (value.incomeType === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Choose one category or one income type.',
      });
    }
    if (
      value.monthRupees.reduce((total, amount) => total + amount, 0) !==
      value.annualRupees
    ) {
      context.addIssue({
        code: 'custom',
        path: ['monthRupees'],
        message: 'The monthly amounts must add up to the yearly amount.',
      });
    }
    const expected = spreadExpenseBudgetAmount(
      value.annualRupees,
      value.phasing,
      value.monthRupees,
    );
    if (
      value.phasing !== 'custom' &&
      expected.some((amount, index) => amount !== value.monthRupees[index])
    ) {
      context.addIssue({
        code: 'custom',
        path: ['monthRupees'],
        message: 'The monthly spread no longer matches the yearly amount.',
      });
    }
  });

export const expenseBudgetDraftInputSchema = z
  .object({
    financialYear: expenseBudgetFinancialYearSchema,
    lines: z.array(budgetHeadInputSchema).max(500),
    copySourceYear: expenseBudgetFinancialYearSchema.nullable(),
    copyPercent: percentBpSchema.nullable(),
    expectedVersion: z.number().int().positive().nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    const headKeys = value.lines.map(
      (line) => line.categoryId ?? `income:${line.incomeType}`,
    );
    if (new Set(headKeys).size !== headKeys.length) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Each budget head can appear only once.',
      });
    }
    if ((value.copySourceYear === null) !== (value.copyPercent === null)) {
      context.addIssue({
        code: 'custom',
        path: ['copyPercent'],
        message: 'Copy preview details are incomplete.',
      });
    }
    if (
      value.copySourceYear !== null &&
      value.copySourceYear !== value.financialYear - 1
    ) {
      context.addIssue({
        code: 'custom',
        path: ['copySourceYear'],
        message: 'Copy only from the previous financial year.',
      });
    }
  });

const approvalFields = {
  approvedBody: z.enum(['committee', 'general_body']),
  approvedOn: z.iso.date(),
  approvalMeetingId: z.uuid().nullable(),
  approvalDocumentId: z.uuid().nullable(),
  approvalNote: optionalText(500),
};

const approvalRefinement = (
  value: {
    approvalMeetingId: string | null;
    approvalDocumentId: string | null;
  },
  context: z.RefinementCtx,
) => {
  if (value.approvalMeetingId && value.approvalDocumentId) {
    context.addIssue({
      code: 'custom',
      path: ['approvalDocumentId'],
      message: 'Link either a meeting resolution or a document, not both.',
    });
  }
};

export const expenseBudgetApproveInputSchema = z
  .object({
    budgetId: z.uuid(),
    ...approvalFields,
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine(approvalRefinement);

export const expenseBudgetDiscardInputSchema = z
  .object({
    budgetId: z.uuid(),
    reason: text(5, 500),
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict();

export const expenseBudgetChangeInputSchema = z
  .object({
    budgetId: z.uuid(),
    changeKind: z.enum(['increase', 'decrease', 'move']),
    categoryId: z.uuid().nullable(),
    incomeType: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
    toCategoryId: z.uuid().nullable(),
    toIncomeType: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
    amountRupees: rupeesSchema,
    effectiveMonth: z.coerce.number().int().min(1).max(12),
    reason: text(5, 500),
    ...approvalFields,
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.categoryId === null) === (value.incomeType === null)) {
      context.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Choose one source budget head.',
      });
    }
    if (value.changeKind === 'move') {
      if ((value.toCategoryId === null) === (value.toIncomeType === null)) {
        context.addIssue({
          code: 'custom',
          path: ['toCategoryId'],
          message: 'Choose one destination budget head.',
        });
      }
      if (
        value.categoryId === value.toCategoryId &&
        value.incomeType === value.toIncomeType
      ) {
        context.addIssue({
          code: 'custom',
          path: ['toCategoryId'],
          message: 'Choose a different destination head.',
        });
      }
    } else if (value.toCategoryId !== null || value.toIncomeType !== null) {
      context.addIssue({
        code: 'custom',
        path: ['toCategoryId'],
        message: 'A single change has no destination head.',
      });
    }
    approvalRefinement(value, context);
  });

export const expenseBudgetVoidInputSchema = z
  .object({
    changeId: z.uuid(),
    reason: text(5, 500),
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict();

const budgetHeadSchema = z.object({
  category_id: z.uuid().nullable(),
  income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
  name: z.string(),
  kind: z.enum(['income', 'spending']),
});

const budgetLineSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid().nullable(),
  income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
  name: z.string(),
  phasing: z.enum(EXPENSE_BUDGET_PHASINGS),
  annual_paise: z.number().int().nonnegative(),
  month_paise: z.array(z.number().int().nonnegative()).length(12),
});

const budgetChangeSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid().nullable(),
  income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
  name: z.string(),
  direction: z.enum(['increase', 'decrease']),
  amount_paise: z.number().int().positive(),
  effective_month: z.number().int().min(1).max(12),
  month_paise: z.array(z.number().int().nonnegative()).length(12),
  reason: z.string(),
  approved_body: z.enum(['committee', 'general_body']),
  approved_on: z.iso.date(),
  approval_meeting_id: z.uuid().nullable(),
  approval_document_id: z.uuid().nullable(),
  approval_note: z.string().nullable(),
  pair_id: z.uuid().nullable(),
  voided_at: timestamp.nullable(),
  void_reason: z.string().nullable(),
  created_at: timestamp,
});

export const expenseBudgetSchema = z.object({
  financial_year: expenseBudgetFinancialYearSchema,
  today: z.iso.date(),
  can_manage: z.boolean(),
  settings: z.object({
    budget_forecast_method: z.enum(['budget', 'average_3_months', 'none']),
    budget_watch_percent: z.number().int().min(50).max(100),
    budget_resident_summary: z.boolean(),
    updated_at: timestamp,
  }),
  budget: z
    .object({
      id: z.uuid(),
      financial_year: expenseBudgetFinancialYearSchema,
      status: z.enum(['draft', 'approved']),
      copy_source_year: expenseBudgetFinancialYearSchema.nullable(),
      copy_percent_bp: z.number().int().min(-5000).max(10000).nullable(),
      approved_body: z.enum(['committee', 'general_body']).nullable(),
      approved_on: z.iso.date().nullable(),
      approval_meeting_id: z.uuid().nullable(),
      approval_document_id: z.uuid().nullable(),
      approval_note: z.string().nullable(),
      approved_by: z.uuid().nullable(),
      approved_at: timestamp.nullable(),
      version: z.number().int().positive(),
      created_at: timestamp,
      updated_at: timestamp,
    })
    .nullable(),
  heads: z.array(budgetHeadSchema),
  lines: z.array(budgetLineSchema),
  changes: z.array(budgetChangeSchema),
  current_plan: z.array(
    budgetHeadSchema.extend({
      line_id: z.uuid().nullable(),
      original_paise: z.number().int().nonnegative(),
      changes_paise: z.number().int(),
      current_paise: z.number().int().nonnegative(),
      original_month_paise: z.array(z.number().int().nonnegative()).length(12),
      current_month_paise: z.array(z.number().int().nonnegative()).length(12),
    }),
  ),
  approval_choices: z.object({
    meetings: z.array(z.object({ id: z.uuid(), label: z.string() })),
    documents: z.array(z.object({ id: z.uuid(), label: z.string() })),
  }),
});

export const expenseBudgetCopyPreviewInputSchema = z
  .object({
    financialYear: expenseBudgetFinancialYearSchema,
    percent: percentBpSchema.nullable(),
  })
  .strict();

export const expenseBudgetCopyPreviewSchema = z.object({
  source_financial_year: expenseBudgetFinancialYearSchema,
  percent_bp: z.number().int().min(-5000).max(10000),
  lines: z.array(
    z.object({
      category_id: z.uuid().nullable(),
      income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
      name: z.string(),
      annual_paise: z.number().int().nonnegative(),
      phasing: z.literal('equal_monthly'),
      month_paise: z.array(z.number().int().nonnegative()).length(12),
    }),
  ),
});

export const expenseBudgetReportInputSchema = z
  .object({
    financialYear: expenseBudgetFinancialYearSchema,
    asOf: z.iso.date(),
  })
  .strict();

const expenseBudgetReportSummarySchema = z.object({
  category_id: z.uuid().nullable(),
  income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
  name: z.string(),
  kind: z.enum(['income', 'spending']),
  budgeted: z.boolean(),
  original_paise: z.number().int().nonnegative(),
  changes_paise: z.number().int(),
  current_paise: z.number().int().nonnegative(),
  plan_to_date_paise: z.number().int().nonnegative(),
  actual_to_date_paise: z.number().int(),
  difference_paise: z.number().int(),
  difference_label: z.enum([
    'Better than budget',
    'Below budget',
    'Over budget',
  ]),
  percent_used_bp: z.number().nullable(),
  burn_rate_bp: z.number().nullable(),
  warning: z.enum(['on_track', 'watch', 'over_plan']).nullable(),
  projected_year_end_paise: z.number().nullable(),
  projected_overrun_paise: z.number().positive().nullable(),
  projection_available: z.boolean(),
});

export const expenseBudgetReportSchema = z.object({
  financial_year: expenseBudgetFinancialYearSchema,
  from: z.iso.date(),
  to: z.iso.date(),
  as_of: z.iso.date(),
  approved: z.boolean(),
  forecast_method: z.enum(['budget', 'average_3_months', 'none']),
  months_averaged: z.number().int().nonnegative(),
  summary: z.array(expenseBudgetReportSummarySchema),
  months: z.array(
    z.object({
      month: z.iso.date(),
      heads: z.array(
        z.object({
          category_id: z.uuid().nullable(),
          income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
          name: z.string(),
          kind: z.enum(['income', 'spending']),
          budget_paise: z.number().int().nonnegative(),
          actual_paise: z.number().int(),
        }),
      ),
    }),
  ),
  cash_flow: z.array(
    z.object({
      month: z.iso.date(),
      money_in_paise: z.number().int().nonnegative(),
      money_out_paise: z.number().int().nonnegative(),
      net_paise: z.number().int(),
      running_paise: z.number().int(),
      is_estimate: z.boolean(),
      forecast_available: z.boolean(),
    }),
  ),
  opening_money_paise: z.number().int(),
  accounts_added_opening_paise: z.number().int(),
});

export const expenseBudgetResidentSummarySchema = z.object({
  shared: z.boolean(),
  financial_year: expenseBudgetFinancialYearSchema,
  approved_on: z.iso.date().nullable(),
  rows: z.array(
    z.object({
      category_id: z.uuid().nullable(),
      income_type: z.enum(EXPENSE_BUDGET_INCOME_TYPES).nullable(),
      name: z.string(),
      kind: z.enum(['income', 'spending']),
      current_paise: z.number().int().nonnegative(),
      actual_to_date_paise: z.number().int(),
      percent_used_bp: z.number().int().nullable(),
    }),
  ),
  totals: z.object({
    income_paise: z.number().int().nonnegative(),
    spending_paise: z.number().int().nonnegative(),
  }),
});

export const expenseBudgetSettingsInputSchema = z
  .object({
    forecastMethod: z.enum(['budget', 'average_3_months', 'none']),
    watchPercent: z.number().int().min(50).max(100),
    residentSummary: z.boolean(),
    expectedUpdatedAt: timestamp,
  })
  .strict();

export type ExpenseBudget = z.infer<typeof expenseBudgetSchema>;
export type ExpenseBudgetCopyPreview = z.infer<
  typeof expenseBudgetCopyPreviewSchema
>;
export type ExpenseBudgetReport = z.infer<typeof expenseBudgetReportSchema>;
export type ExpenseBudgetResidentSummary = z.infer<
  typeof expenseBudgetResidentSummarySchema
>;
