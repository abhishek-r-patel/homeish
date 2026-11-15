// Validate P16 expense inputs, RPC payloads and module settings.
import { z } from 'zod';
import { nonnegativeRupeesSchema, rupeesSchema } from '../billing/validation';

const timestamp = z.iso.datetime({ offset: true });
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const money = z.number().int().safe();

export const DEFAULT_EXPENSE_APPROVAL_THRESHOLD_PAISE = 5_000_000;
export const DEFAULT_EXPENSE_SETTINGS = {
  approval_threshold_paise: DEFAULT_EXPENSE_APPROVAL_THRESHOLD_PAISE,
  billing_income_account_id: null,
};
export const expenseSettingsSchema = z
  .object({
    approval_threshold_paise: z
      .number()
      .int()
      .min(0)
      .max(999_999_999_999_999)
      .optional(),
    billing_income_account_id: z.uuid().nullable().optional(),
  })
  .strict();

export const EXPENSE_PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque'] as const;
export const EXPENSE_INCOME_KINDS = ['donation', 'interest', 'other'] as const;
export const EXPENSE_STATUSES = [
  'pending_approval',
  'posted',
  'rejected',
] as const;

const signedRupeesSchema = z
  .string()
  .trim()
  .max(33)
  .transform((value, context) => {
    const negative = value.startsWith('-');
    const parsed = nonnegativeRupeesSchema.safeParse(
      negative ? value.slice(1) : value,
    );
    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        message: 'Enter rupees with at most two decimal places.',
      });
      return z.NEVER;
    }
    return negative ? -parsed.data : parsed.data;
  });

export const expenseSettingsInputSchema = z
  .object({
    thresholdRupees: nonnegativeRupeesSchema,
    billingIncomeAccountId: z.uuid().nullable(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict();
export const expenseAccountInputSchema = z
  .object({
    accountId: z.uuid().nullable(),
    name: text(120),
    accountType: z.enum(['cash', 'bank']),
    openingBalanceRupees: signedRupeesSchema,
    openingOn: z.iso.date(),
    active: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.accountId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the account before editing.',
      });
  });
export const expenseCategoryInputSchema = z
  .object({
    categoryId: z.uuid().nullable(),
    name: text(120),
    active: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.categoryId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the category before editing.',
      });
  });
export const expenseRecordInputSchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid(),
    spentOn: z.iso.date(),
    payee: text(120),
    amountRupees: rupeesSchema,
    paymentMode: z.enum(EXPENSE_PAYMENT_MODES),
    reference: optionalText(120),
    description: optionalText(2000),
    receiptPath: text(500).nullable(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseDecisionInputSchema = z
  .object({
    expenseId: z.uuid(),
    approve: z.boolean(),
    note: optionalText(1000),
  })
  .strict()
  .refine((value) => value.approve || value.note !== null, {
    path: ['note'],
    message: 'Give a reason for rejecting the expense.',
  });
export const expenseIncomeInputSchema = z
  .object({
    accountId: z.uuid(),
    receivedOn: z.iso.date(),
    incomeKind: z.enum(EXPENSE_INCOME_KINDS),
    payer: text(120),
    amountRupees: rupeesSchema,
    reference: optionalText(120),
    description: optionalText(2000),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseReverseInputSchema = z
  .object({
    entryId: z.uuid(),
    reverseOn: z.iso.date(),
    reason: text(1000),
    clientRequestId: z.uuid(),
  })
  .strict();
const monthSchema = z.iso
  .date()
  .refine((value) => value.endsWith('-01'), 'Choose the first of a month.');
export const expenseMonthCloseInputSchema = z
  .object({ month: monthSchema })
  .strict();
export const expenseMonthReopenInputSchema = z
  .object({ month: monthSchema, reason: text(1000) })
  .strict();
export const expenseRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .strict()
  .refine(
    ({ from, to }) =>
      from <= to &&
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000 <=
        731,
    'Choose a range of up to two years.',
  );

const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  account_type: z.enum(['cash', 'bank']),
  opening_balance_paise: money,
  opening_on: z.iso.date(),
  active: z.boolean(),
  updated_at: timestamp,
  balance_paise: money,
  has_entries: z.boolean(),
});
const categorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  updated_at: timestamp,
});
export const expenseWorkspaceSchema = z.object({
  today: z.iso.date(),
  actor_id: z.uuid(),
  can_manage: z.boolean(),
  can_approve: z.boolean(),
  billing_enabled: z.boolean(),
  settings: z.object({
    approval_threshold_paise: money.nonnegative(),
    billing_income_account_id: z.uuid().nullable(),
    updated_at: timestamp.nullable(),
  }),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  closed_months: z.array(z.iso.date()),
});
export const expenseRowSchema = z.object({
  id: z.uuid(),
  spent_on: z.iso.date(),
  payee: z.string(),
  amount_paise: money.positive(),
  payment_mode: z.enum(EXPENSE_PAYMENT_MODES),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  receipt_path: z.string().nullable(),
  status: z.enum(EXPENSE_STATUSES),
  approval_required: z.boolean(),
  decision_note: z.string().nullable(),
  decided_at: timestamp.nullable(),
  account_name: z.string(),
  category_name: z.string(),
  recorded_by: z.uuid(),
  recorded_by_name: z.string(),
  decided_by_name: z.string().nullable(),
  created_at: timestamp,
});
export const expensePageSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(expenseRowSchema),
});
export const expenseEntrySchema = z.object({
  id: z.uuid(),
  entry_date: z.iso.date(),
  direction: z.enum(['in', 'out']),
  amount_paise: money.positive(),
  source: z.enum(['expense', 'income', 'billing_payment', 'reversal']),
  account_id: z.uuid(),
  account_name: z.string(),
  category_name: z.string().nullable(),
  income_kind: z.enum(EXPENSE_INCOME_KINDS).nullable(),
  counterparty: z.string(),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  expense_id: z.uuid().nullable(),
  receipt_path: z.string().nullable(),
  reverses_entry_id: z.uuid().nullable(),
  reversed_by_entry_id: z.uuid().nullable(),
  month_closed: z.boolean(),
});
export const expenseEntriesPageSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(expenseEntrySchema),
});
export const expenseReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  income_paise: money,
  expense_paise: money,
  months: z.array(
    z.object({
      month: z.iso.date(),
      income_paise: money,
      expense_paise: money,
    }),
  ),
  categories: z.array(z.object({ category: z.string(), expense_paise: money })),
  income_sources: z.array(
    z.object({
      source: z.enum(['billing', ...EXPENSE_INCOME_KINDS]),
      income_paise: money,
    }),
  ),
  balances: z.array(
    z.object({
      account: z.string(),
      account_type: z.enum(['cash', 'bank']),
      active: z.boolean(),
      balance_paise: money,
    }),
  ),
  billing_enabled: z.boolean(),
  outstanding_dues_paise: money.nullable(),
});
export const expenseRecordResultSchema = z.object({
  id: z.uuid(),
  status: z.enum(EXPENSE_STATUSES),
});

// Financial years run April to March; default views start at the current one.
export function expenseFinancialYearStart(today: string): string {
  const [year, month] = today.split('-').map(Number);
  return `${month >= 4 ? year : year - 1}-04-01`;
}
export function expenseRangeOrDefault(
  query: { from?: string; to?: string },
  today: string,
): { from: string; to: string } {
  const parsed = expenseRangeSchema.safeParse({
    from: query.from,
    to: query.to,
  });
  return parsed.success
    ? parsed.data
    : { from: expenseFinancialYearStart(today), to: today };
}

export type ExpenseWorkspace = z.infer<typeof expenseWorkspaceSchema>;
export type ExpenseAccount = z.infer<typeof accountSchema>;
export type ExpenseCategory = z.infer<typeof categorySchema>;
export type ExpenseRow = z.infer<typeof expenseRowSchema>;
export type ExpenseEntry = z.infer<typeof expenseEntrySchema>;
export type ExpenseReport = z.infer<typeof expenseReportSchema>;
