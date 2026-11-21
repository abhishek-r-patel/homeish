// Validate P16/P39 expense inputs, RPC payloads and module settings.
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
const optionalPositiveRupees = rupeesSchema.nullable();
const optionalRate = z
  .string()
  .trim()
  .nullable()
  .transform((value, context) => {
    if (value === null || value === '') return null;
    if (!/^\d{1,2}(\.\d{1,4})?$|^100(\.0{1,4})?$/.test(value)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a rate from 0 to 100 with up to four decimal places.',
      });
      return z.NEVER;
    }
    return Number(value);
  });

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
    accountType: z.enum(['cash', 'bank', 'deposit']),
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

export const EXPENSE_FUND_WARNING =
  'Fund tracking allocates the existing Accounts total for reference. It does not move cash, create a bill or prove financial, legal or statutory authority.';

export const expenseFundInputSchema = z
  .object({
    fundId: z.uuid().nullable(),
    name: text(120),
    active: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.fundId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the fund before editing.',
      });
  });
export const expenseFundActivationInputSchema = z
  .object({
    cutoverOn: monthSchema,
    allocations: z
      .array(
        z
          .object({
            fundId: z.uuid(),
            amountRupees: nonnegativeRupeesSchema,
          })
          .strict(),
      )
      .min(1)
      .max(200),
    acknowledged: z.boolean().refine(Boolean, {
      message: 'Acknowledge the fund-tracking warning.',
    }),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseFundCutoverQuerySchema = monthSchema.nullish();
export const expenseFundMappingInputSchema = z
  .object({
    sourceKind: z.enum(['expense_category', 'income_kind', 'billing_charge']),
    sourceId: z.uuid().nullable(),
    incomeKind: z.enum(EXPENSE_INCOME_KINDS).nullable(),
    fundId: z.uuid().nullable(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.sourceKind === 'expense_category' &&
        (value.sourceId === null || value.incomeKind !== null)) ||
      (value.sourceKind === 'income_kind' &&
        (value.sourceId !== null || value.incomeKind === null)) ||
      (value.sourceKind === 'billing_charge' &&
        (value.sourceId === null || value.incomeKind !== null))
    )
      context.addIssue({
        code: 'custom',
        path: ['sourceKind'],
        message: 'Choose a valid fund suggestion source.',
      });
  });
export const expenseFundAllocationInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            entryId: z.uuid(),
            allocations: z
              .array(
                z
                  .object({
                    fundId: z.uuid().nullable(),
                    amountRupees: rupeesSchema,
                  })
                  .strict(),
              )
              .min(1)
              .max(200),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseFundOpeningCorrectionInputSchema = z
  .object({
    allocations: z
      .array(
        z
          .object({
            fundId: z.uuid(),
            amountRupees: nonnegativeRupeesSchema,
          })
          .strict(),
      )
      .min(1)
      .max(200),
    reason: text(1000),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseFundAllocationCorrectionInputSchema = z
  .object({
    entryId: z.uuid(),
    allocations: z
      .array(
        z
          .object({
            fundId: z.uuid().nullable(),
            amountRupees: rupeesSchema,
          })
          .strict(),
      )
      .min(1)
      .max(200),
    reason: text(1000),
    clientRequestId: z.uuid(),
  })
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
  account_type: z.enum(['cash', 'bank', 'deposit']),
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
  source: z.enum([
    'expense',
    'income',
    'billing_payment',
    'reversal',
    'transfer',
  ]),
  transfer_pair_id: z.uuid().nullable(),
  transfer_account_name: z.string().nullable(),
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
  voucher_no: z.string(),
  running_balance_paise: money.nullable(),
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
      net_paise: money,
      cumulative_net_paise: money,
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
      account_type: z.enum(['cash', 'bank', 'deposit']),
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

export const STATEMENT_ITEM_STATUSES = [
  'unmatched',
  'matched',
  'cancelled',
] as const;
export const statementItemInputSchema = z
  .object({
    accountId: z.uuid(),
    statementDate: z.iso.date(),
    reference: optionalText(80),
    party: optionalText(120),
    direction: z.enum(['in', 'out']),
    amountRupees: rupeesSchema,
    clientRequestId: z.uuid(),
  })
  .strict();
export const statementItemMatchInputSchema = z
  .object({ itemId: z.uuid(), entryId: z.uuid() })
  .strict();
export const statementItemCancelInputSchema = z
  .object({ itemId: z.uuid(), reason: text(1000) })
  .strict();
export const reconciliationSchema = z.object({
  today: z.iso.date(),
  total: z.number().int().nonnegative(),
  old_total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: z.uuid(),
      statement_date: z.iso.date(),
      reference: z.string().nullable(),
      party: z.string().nullable(),
      direction: z.enum(['in', 'out']),
      amount_paise: money.positive(),
      status: z.enum(STATEMENT_ITEM_STATUSES),
      matched_entry_id: z.uuid().nullable(),
      matched_voucher_no: z.string().nullable(),
      cancel_reason: z.string().nullable(),
      decided_by_name: z.string().nullable(),
      decided_at: timestamp.nullable(),
      is_old: z.boolean(),
    }),
  ),
  unmatched_entries_total: z.number().int().nonnegative(),
  unmatched_entries: z.array(
    z.object({
      id: z.uuid(),
      entry_date: z.iso.date(),
      direction: z.enum(['in', 'out']),
      amount_paise: money.positive(),
      counterparty: z.string(),
      reference: z.string().nullable(),
      voucher_no: z.string(),
    }),
  ),
});

export const pettyCashAssignInputSchema = z
  .object({
    accountId: z.uuid(),
    custodianUserId: z.uuid(),
    handoverCountRupees: nonnegativeRupeesSchema.nullable(),
    handoverNote: optionalText(500),
    clientRequestId: z.uuid(),
  })
  .strict();
export const cashCountInputSchema = z
  .object({
    countDate: z.iso.date(),
    countedRupees: nonnegativeRupeesSchema,
    note: optionalText(500),
    clientRequestId: z.uuid(),
  })
  .strict();
export const pettyCashViewSchema = z.object({
  today: z.iso.date(),
  can_assign: z.boolean(),
  can_record: z.boolean(),
  is_custodian: z.boolean(),
  account: z
    .object({
      id: z.uuid(),
      name: z.string(),
      active: z.boolean(),
      opening_on: z.iso.date(),
    })
    .nullable(),
  book_paise: money.nullable(),
  custodian: z
    .object({
      user_id: z.uuid(),
      full_name: z.string(),
      started_at: timestamp,
    })
    .nullable(),
  counts: z.array(
    z.object({
      id: z.uuid(),
      count_date: z.iso.date(),
      counted_paise: money.nonnegative(),
      book_paise: money,
      difference_paise: money,
      note: z.string().nullable(),
      kind: z.enum(['routine', 'handover']),
      counted_by_name: z.string(),
      created_at: timestamp,
    }),
  ),
  history: z.array(
    z.object({
      id: z.uuid(),
      full_name: z.string(),
      started_at: timestamp,
      ended_at: timestamp.nullable(),
      started_by_name: z.string(),
      handover_counted_paise: money.nullable(),
      handover_book_paise: money.nullable(),
    }),
  ),
  cash_account: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  members: z.array(z.object({ user_id: z.uuid(), full_name: z.string() })),
});

const expenseFundSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  updated_at: timestamp,
});
const expenseFundAllocationSchema = z.object({
  fund_id: z.uuid().nullable(),
  fund_name: z.string().nullable(),
  amount_paise: money.positive(),
});
const expenseFundActivityEntrySchema = z.object({
  entry_id: z.uuid(),
  entry_date: z.iso.date(),
  direction: z.enum(['in', 'out']),
  amount_paise: money.positive(),
  counterparty: z.string(),
  source: z.enum(['expense', 'income', 'billing_payment', 'reversal']),
  category_name: z.string().nullable(),
  income_kind: z.enum(EXPENSE_INCOME_KINDS).nullable(),
  voucher_no: z.string(),
  month_closed: z.boolean(),
  allocations: z.array(expenseFundAllocationSchema),
  suggested_fund_id: z.uuid().nullable(),
});
export const expenseFundsActivitySchema = z.object({
  balances: z.array(
    z.object({
      fund_id: z.uuid(),
      fund_name: z.string(),
      opening_paise: money.nonnegative(),
      balance_paise: money,
    }),
  ),
  unallocated_paise: money.nullable(),
  mappings: z.object({
    expense_categories: z.array(
      z.object({
        category_id: z.uuid(),
        category_name: z.string(),
        fund_id: z.uuid().nullable(),
        updated_at: timestamp.nullable(),
      }),
    ),
    income_kinds: z.array(
      z.object({
        income_kind: z.enum(EXPENSE_INCOME_KINDS),
        fund_id: z.uuid().nullable(),
        updated_at: timestamp.nullable(),
      }),
    ),
  }),
  entries_total: z.number().int().nonnegative(),
  entries: z.array(expenseFundActivityEntrySchema),
});
export const expenseFundAllocationResultSchema = z.object({
  confirmed_count: z.number().int().nonnegative(),
  skipped: z.array(
    z.object({
      entry_id: z.uuid(),
      voucher: z.string().nullable(),
      reason: z.literal('month_closed'),
    }),
  ),
});
export const expenseFundsWorkspaceSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  funds: z.array(expenseFundSchema),
  eligible_cutovers: z.array(z.iso.date()),
  opening: z
    .object({
      id: z.uuid(),
      cutover_on: z.iso.date(),
      accounts_total_paise: money,
      allocated_total_paise: money.nonnegative(),
      unallocated_paise: money.nonnegative(),
      warning_acknowledged_text: z.string(),
      activated_at: timestamp,
      activated_by_name: z.string().nullable(),
      review_required: z.boolean(),
      review_reasons: z.array(
        z.enum([
          'previous_month_reopened',
          'accounts_total_changed',
          'backdated_entry_added',
          'opening_account_changed',
        ]),
      ),
      current_accounts_total_paise: money,
      reviewed_at: timestamp,
      allocations: z.array(
        z.object({
          fund_id: z.uuid(),
          fund_name: z.string(),
          amount_paise: money.nonnegative(),
        }),
      ),
    })
    .nullable(),
  preview: z
    .object({
      cutover_on: z.iso.date(),
      as_of: z.iso.date(),
      accounts_total_paise: money,
      previous_month_closed: z.boolean(),
    })
    .nullable(),
});

// A count above the book is "over"; below is "short" (EXP-10 shows, never posts).
export function cashDifferenceKind(
  differencePaise: number,
): 'over' | 'short' | 'matches' {
  if (differencePaise > 0) return 'over';
  if (differencePaise < 0) return 'short';
  return 'matches';
}

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
export type ExpenseFund = z.infer<typeof expenseFundSchema>;
export type ExpenseFundsWorkspace = z.infer<typeof expenseFundsWorkspaceSchema>;
export type ExpenseFundActivityEntry = z.infer<
  typeof expenseFundActivityEntrySchema
>;
export type ExpenseFundsActivity = z.infer<typeof expenseFundsActivitySchema>;
export type ExpenseRow = z.infer<typeof expenseRowSchema>;
export type ExpenseEntry = z.infer<typeof expenseEntrySchema>;
export type ExpenseReport = z.infer<typeof expenseReportSchema>;
export type Reconciliation = z.infer<typeof reconciliationSchema>;
export type PettyCashView = z.infer<typeof pettyCashViewSchema>;

export const expenseTransferInputSchema = z
  .object({
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    transferOn: z.iso.date(),
    amountRupees: rupeesSchema,
    reference: optionalText(120),
    note: optionalText(2000),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    (value) => value.fromAccountId !== value.toAccountId,
    'Choose two different accounts.',
  );
export const expenseTransferReverseInputSchema = z
  .object({
    transferPairId: z.uuid(),
    reverseOn: z.iso.date(),
    reason: text(1000),
    clientRequestId: z.uuid(),
  })
  .strict();

export const expenseFixedDepositInputSchema = z
  .object({
    depositId: z.uuid().nullable(),
    predecessorId: z.uuid().nullable(),
    fundId: z.uuid(),
    accountId: z.uuid().nullable(),
    bankName: text(120),
    reference: optionalText(120),
    principalRupees: optionalPositiveRupees,
    quotedRate: optionalRate,
    depositOn: z.iso.date(),
    maturityOn: z.iso.date(),
    maturityValueRupees: optionalPositiveRupees,
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .refine((value) => value.maturityOn > value.depositOn, {
    path: ['maturityOn'],
    message: 'Choose a maturity date after the deposit date.',
  })
  .superRefine((value, context) => {
    if ((value.depositId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the fixed deposit before editing.',
      });
  });

const expenseFixedDepositSchema = z.object({
  id: z.uuid(),
  fund_id: z.uuid(),
  fund_name: z.string(),
  account_id: z.uuid().nullable(),
  account_name: z.string().nullable(),
  predecessor_id: z.uuid().nullable(),
  bank_name: z.string(),
  reference: z.string().nullable(),
  principal_paise: money.nullable(),
  quoted_rate: z.number().nonnegative().max(100).nullable(),
  deposit_on: z.iso.date(),
  maturity_on: z.iso.date(),
  maturity_value_paise: money.nullable(),
  account_balance_paise: money.nullable(),
  reconciliation_status: z.enum([
    'not_reconciled',
    'principal_unknown',
    'matched',
    'difference',
  ]),
  days_to_maturity: z.number().int(),
  maturity_follow_up: z.boolean(),
  updated_at: timestamp,
});
export const expenseFixedDepositsSchema = z.object({
  can_manage: z.boolean(),
  deposits: z.array(expenseFixedDepositSchema),
});
export type ExpenseFixedDeposit = z.infer<typeof expenseFixedDepositSchema>;

export const expenseFundInterestInputSchema = z
  .object({
    recordId: z.uuid().nullable(),
    fundId: z.uuid(),
    fixedDepositId: z.uuid().nullable(),
    incomeEntryId: z.uuid().nullable(),
    sourceLabel: text(120),
    periodFrom: z.iso.date(),
    periodTo: z.iso.date(),
    grossInterestRupees: optionalPositiveRupees,
    taxWithheldRupees: optionalPositiveRupees,
    actualCreditRupees: optionalPositiveRupees,
    averageBalanceRupees: optionalPositiveRupees,
    note: optionalText(2000),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .refine((value) => value.periodTo > value.periodFrom, {
    path: ['periodTo'],
    message: 'Choose an end date after the start date.',
  })
  .refine(
    (value) =>
      value.grossInterestRupees === null ||
      value.taxWithheldRupees === null ||
      value.taxWithheldRupees <= value.grossInterestRupees,
    {
      path: ['taxWithheldRupees'],
      message: 'Tax withheld cannot exceed gross interest.',
    },
  )
  .superRefine((value, context) => {
    if ((value.recordId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the interest record before editing.',
      });
  });

const expenseFundInterestSchema = z.object({
  id: z.uuid(),
  fund_id: z.uuid(),
  fund_name: z.string(),
  fixed_deposit_id: z.uuid().nullable(),
  income_entry_id: z.uuid().nullable(),
  source_label: z.string(),
  period_from: z.iso.date(),
  period_to: z.iso.date(),
  gross_interest_paise: money.nullable(),
  tax_withheld_paise: money.nullable(),
  net_interest_paise: money.nullable(),
  actual_credit_paise: money.nullable(),
  average_balance_paise: money.nullable(),
  accounts_income_paise: money.nullable(),
  credit_difference_paise: money.nullable(),
  whole_months: z.number().int().nonnegative(),
  annualised_yield_percent: z.number().nonnegative().nullable(),
  note: z.string().nullable(),
  updated_at: timestamp,
});
export const expenseFundInterestRecordsSchema = z.object({
  can_manage: z.boolean(),
  interest_entries: z.array(
    z.object({
      entry_id: z.uuid(),
      voucher_no: z.string(),
      entry_date: z.iso.date(),
      counterparty: z.string(),
      amount_paise: money.positive(),
    }),
  ),
  records: z.array(expenseFundInterestSchema),
});
export type ExpenseFundInterestRecord = z.infer<
  typeof expenseFundInterestSchema
>;

const expenseFundBillingAllocationSchema = z.object({
  fund_id: z.uuid().nullable(),
  fund_name: z.string().nullable(),
  amount_paise: money.positive(),
});
export const expenseFundBillingMappingsSchema = z.array(
  z.object({
    charge_type_id: z.uuid(),
    charge_name: z.string(),
    fund_id: z.uuid().nullable(),
    updated_at: timestamp.nullable(),
  }),
);
export const expenseBillingCollectionSuggestionsSchema = z.array(
  z.object({
    entry_id: z.uuid(),
    allocations: z.array(expenseFundBillingAllocationSchema),
  }),
);
export type ExpenseBillingCollectionSuggestion = z.infer<
  (typeof expenseBillingCollectionSuggestionsSchema)['element']
>;
export type ExpenseFundBillingMapping = z.infer<
  (typeof expenseFundBillingMappingsSchema)['element']
>;

export const expenseFundTransferRuleInputSchema = z
  .object({
    ruleId: z.uuid().nullable(),
    fromFundId: z.uuid(),
    toFundId: z.uuid(),
    active: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .refine((value) => value.fromFundId !== value.toFundId, {
    path: ['toFundId'],
    message: 'Choose two different funds.',
  })
  .superRefine((value, context) => {
    if ((value.ruleId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the transfer rule before editing.',
      });
  });
export const expenseFundTransferInputSchema = z
  .object({
    fromFundId: z.uuid(),
    toFundId: z.uuid(),
    transferOn: z.iso.date(),
    amountRupees: rupeesSchema,
    reason: text(1000),
    decisionReference: text(120),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine((value) => value.fromFundId !== value.toFundId, {
    path: ['toFundId'],
    message: 'Choose two different funds.',
  });
export const expenseFundTransferReverseInputSchema = z
  .object({
    transferId: z.uuid(),
    reverseOn: z.iso.date(),
    reason: text(1000),
    clientRequestId: z.uuid(),
  })
  .strict();
const expenseFundTransferRuleSchema = z.object({
  id: z.uuid(),
  from_fund_id: z.uuid(),
  from_fund_name: z.string(),
  to_fund_id: z.uuid(),
  to_fund_name: z.string(),
  active: z.boolean(),
  updated_at: timestamp,
});
const expenseFundTransferSchema = z.object({
  id: z.uuid(),
  from_fund_id: z.uuid(),
  from_fund_name: z.string(),
  to_fund_id: z.uuid(),
  to_fund_name: z.string(),
  transfer_on: z.iso.date(),
  amount_paise: money.positive(),
  reason: z.string(),
  decision_reference: z.string(),
  reverses_transfer_id: z.uuid().nullable(),
});
export const expenseFundTransfersSchema = z.object({
  can_manage: z.boolean(),
  rules: z.array(expenseFundTransferRuleSchema),
  transfers: z.array(expenseFundTransferSchema),
});
export type ExpenseFundTransferRule = z.infer<
  typeof expenseFundTransferRuleSchema
>;
export type ExpenseFundTransfer = z.infer<typeof expenseFundTransferSchema>;

export const expenseFundCorpusInputSchema = z
  .object({
    recordId: z.uuid().nullable(),
    unitId: z.uuid(),
    fundId: z.uuid(),
    eventDescription: text(1000),
    eventOn: z.iso.date(),
    reportedAmountRupees: rupeesSchema,
    concessionRupees: nonnegativeRupeesSchema,
    concessionReason: optionalText(1000).nullable(),
    decisionReference: text(120),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.concessionRupees <= value.reportedAmountRupees &&
      (value.concessionRupees === 0
        ? value.concessionReason === null
        : value.concessionReason !== null),
    {
      path: ['concessionRupees'],
      message:
        'Keep the concession within the reported amount and give a reason when it is used.',
    },
  )
  .superRefine((value, context) => {
    if ((value.recordId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the corpus record before editing.',
      });
  });
export const expenseFundReceiptLinkInputSchema = z
  .object({
    corpusRecordId: z.uuid(),
    entryId: z.uuid(),
    amountRupees: rupeesSchema,
    clientRequestId: z.uuid(),
  })
  .strict();
const expenseCorpusRecordSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  unit_label_snapshot: z.string(),
  fund_id: z.uuid(),
  fund_name: z.string(),
  event_description: z.string(),
  event_on: z.iso.date(),
  reported_amount_paise: money.positive(),
  concession_paise: money.nonnegative(),
  concession_reason: z.string().nullable(),
  decision_reference: z.string(),
  linked_receipts_paise: money.nonnegative(),
  remaining_paise: money,
  updated_at: timestamp,
});
export const expenseFundCorpusSchema = z.object({
  can_manage: z.boolean(),
  units: z.array(z.object({ id: z.uuid(), label: z.string() })),
  records: z.array(expenseCorpusRecordSchema),
  eligible_receipts: z.array(
    z.object({
      entry_id: z.uuid(),
      fund_id: z.uuid(),
      voucher_no: z.string(),
      entry_date: z.iso.date(),
      counterparty: z.string(),
      amount_paise: money.positive(),
    }),
  ),
});
export type ExpenseFundCorpusRecord = z.infer<typeof expenseCorpusRecordSchema>;

export const expenseFundWorkInputSchema = z
  .object({
    workId: z.uuid().nullable(),
    fundId: z.uuid(),
    title: text(200),
    sanctionedAmountRupees: rupeesSchema,
    sanctionedOn: z.iso.date(),
    validUntil: z.iso.date().nullable(),
    meetingResolutionId: z.uuid().nullable(),
    externalReference: optionalText(120),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      (value.meetingResolutionId === null) !==
      (value.externalReference === null),
    {
      path: ['externalReference'],
      message: 'Choose either a Homeish resolution or an external reference.',
    },
  )
  .refine(
    (value) =>
      value.validUntil === null || value.validUntil >= value.sanctionedOn,
    {
      path: ['validUntil'],
      message: 'Choose a validity date on or after the sanction date.',
    },
  )
  .superRefine((value, context) => {
    if ((value.workId === null) !== (value.expectedUpdatedAt === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the sanctioned work before editing.',
      });
  });
export const expenseFundWorkLinkInputSchema = z
  .object({
    workId: z.uuid(),
    entryId: z.uuid(),
    amountRupees: rupeesSchema,
    clientRequestId: z.uuid(),
  })
  .strict();
const expenseFundWorkSchema = z.object({
  id: z.uuid(),
  fund_id: z.uuid(),
  fund_name: z.string(),
  title: z.string(),
  sanctioned_amount_paise: money.positive(),
  sanctioned_on: z.iso.date(),
  valid_until: z.iso.date().nullable(),
  meeting_resolution_id: z.uuid().nullable(),
  resolution_title_snapshot: z.string().nullable(),
  external_reference: z.string().nullable(),
  authority_status: z.enum([
    'external',
    'meeting_unavailable',
    'resolution_removed',
    'changed',
    'current',
  ]),
  utilized_paise: money.nonnegative(),
  expired: z.boolean(),
  overrun: z.boolean(),
  updated_at: timestamp,
});
export const expenseFundWorksSchema = z.object({
  can_manage: z.boolean(),
  resolutions: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      version: z.number().int().positive(),
      outcome: z.literal('passed'),
    }),
  ),
  works: z.array(expenseFundWorkSchema),
  eligible_expenses: z.array(
    z.object({
      entry_id: z.uuid(),
      fund_id: z.uuid(),
      voucher_no: z.string(),
      entry_date: z.iso.date(),
      payee: z.string(),
      amount_paise: money.nonnegative(),
    }),
  ),
});
export type ExpenseFundWork = z.infer<typeof expenseFundWorkSchema>;

export const expenseFundReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  accounts_total_paise: money,
  named_funds_total_paise: money,
  unallocated_paise: money,
  funds: z.array(
    z.object({
      fund_id: z.uuid(),
      fund_name: z.string(),
      balance_paise: money,
      months: z.array(
        z.object({
          month: z.iso.date(),
          entry_in_paise: money.nonnegative(),
          entry_out_paise: money.nonnegative(),
          transfer_in_paise: money.nonnegative(),
          transfer_out_paise: money.nonnegative(),
          net_paise: money,
        }),
      ),
    }),
  ),
  unreconciled_deposits: z.array(
    z.object({
      deposit_id: z.uuid(),
      bank_name: z.string(),
      fund_name: z.string(),
      account_balance_paise: money.nullable(),
      principal_paise: money.nullable(),
    }),
  ),
  missing_data: z.boolean(),
});
export type ExpenseFundReport = z.infer<typeof expenseFundReportSchema>;
