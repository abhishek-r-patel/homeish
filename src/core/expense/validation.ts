// Validate P16/P39/P41/P42 expense inputs, RPC payloads and module settings.
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
  budget_forecast_method: 'budget',
  budget_watch_percent: 90,
  budget_resident_summary: true,
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
    budget_forecast_method: z
      .enum(['budget', 'average_3_months', 'none'])
      .optional(),
    budget_watch_percent: z.number().int().min(50).max(100).optional(),
    budget_resident_summary: z.boolean().optional(),
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
  detail_group: z.string().nullable(),
  cost_nature: z.enum(['fixed', 'variable', 'periodic']).nullable(),
  owner_user_id: z.uuid().nullable(),
  owner_name: z.string().nullable(),
  owner_is_current: z.boolean().nullable(),
  detail_description: z.string().nullable(),
  detail_version: z.number().int().positive(),
  detail_revisions: z.array(
    z.object({
      revision_number: z.number().int().positive(),
      created_at: timestamp,
      created_by_name: z.string(),
    }),
  ),
  updated_at: timestamp,
});
export const expenseWorkspaceSchema = z.object({
  today: z.iso.date(),
  actor_id: z.uuid(),
  can_manage: z.boolean(),
  can_approve: z.boolean(),
  billing_enabled: z.boolean(),
  vendor_enabled: z.boolean(),
  settings: z.object({
    approval_threshold_paise: money.nonnegative(),
    billing_income_account_id: z.uuid().nullable(),
    updated_at: timestamp.nullable(),
  }),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  group_suggestions: z.array(z.string()),
  staff: z.array(z.object({ user_id: z.uuid(), full_name: z.string() })),
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

const financialYearStartSchema = z.iso
  .date()
  .refine(
    (value) => value.endsWith('-04-01'),
    'Choose an April-to-March financial year.',
  );
const expectedVersionSchema = z.number().int().min(1).nullable();
export const EXPENSE_AGM_WARNING =
  'The audit tracker and AGM draft do not replace an auditor, accountant or legal advice. They record society-entered facts and are not a statutory report, certification or submission.';
export const EXPENSE_AGM_SECTION_KEYS = [
  'finances',
  'comparison',
  'funds',
  'audit',
  'position',
  'written',
] as const;
export const expenseAgmSectionsSchema = z
  .object({
    finances: z.boolean(),
    comparison: z.boolean(),
    funds: z.boolean(),
    audit: z.boolean(),
    position: z.boolean(),
    written: z.boolean(),
  })
  .strict();

export const expenseAuditAcknowledgeInputSchema = z
  .object({
    acknowledged: z.boolean().refine(Boolean, {
      message: 'Acknowledge the audit and AGM warning.',
    }),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseAuditYearInputSchema = z
  .object({
    yearId: z.uuid().nullable(),
    financialYearStart: financialYearStartSchema,
    auditorName: text(120),
    auditorFirm: text(160),
    appointedOn: z.iso.date(),
    appointmentReference: optionalText(160).nullable(),
    appointmentDocumentId: z.uuid().nullable(),
    reportReceivedOn: z.iso.date().nullable(),
    placedBeforeAgmOn: z.iso.date().nullable(),
    filedOn: z.iso.date().nullable(),
    opinion: z
      .enum(['unmodified', 'qualified', 'adverse', 'disclaimer', 'other'])
      .nullable(),
    opinionText: optionalText(4000).nullable(),
    expectedVersion: expectedVersionSchema,
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    (value) =>
      value.appointmentReference !== null ||
      value.appointmentDocumentId !== null,
    {
      path: ['appointmentReference'],
      message: 'Add a decision reference or document.',
    },
  )
  .refine(
    (value) => (value.opinion === null) === (value.opinionText === null),
    {
      path: ['opinionText'],
      message: 'Add the copied opinion and its text together.',
    },
  );
export const expenseAuditQueryInputSchema = z
  .object({
    queryId: z.uuid().nullable(),
    auditYearId: z.uuid(),
    queryNumber: z.number().int().min(1).max(999999),
    queryDate: z.iso.date(),
    area: text(120),
    question: text(4000),
    assigneeUserId: z.uuid(),
    dueDate: z.iso.date(),
    response: optionalText(4000).nullable(),
    responseDate: z.iso.date().nullable(),
    expectedVersion: expectedVersionSchema,
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine((value) => value.dueDate >= value.queryDate, {
    path: ['dueDate'],
    message: 'Choose a due date on or after the query date.',
  })
  .refine(
    (value) => (value.response === null) === (value.responseDate === null),
    {
      path: ['response'],
      message: 'Add the response and its date together.',
    },
  );
export const expenseAuditObjectionInputSchema = z
  .object({
    objectionId: z.uuid().nullable(),
    auditYearId: z.uuid(),
    description: text(4000),
    ownerUserId: z.uuid(),
    dueDate: z.iso.date(),
    correctionNote: optionalText(4000).nullable(),
    correctedOn: z.iso.date().nullable(),
    evidenceDocumentId: z.uuid().nullable(),
    expectedVersion: expectedVersionSchema,
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    (value) => (value.correctionNote === null) === (value.correctedOn === null),
    {
      path: ['correctionNote'],
      message: 'Add the correction note and its date together.',
    },
  );
export const expenseAgmDraftInputSchema = z
  .object({
    draftId: z.uuid().nullable(),
    financialYearStart: financialYearStartSchema,
    writtenSections: z
      .array(z.object({ title: text(120), body: text(10_000) }).strict())
      .max(10),
    expectedVersion: expectedVersionSchema,
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseAgmSettingsInputSchema = z
  .object({
    sections: expenseAgmSectionsSchema,
    expectedUpdatedAt: timestamp,
  })
  .strict();

export const expenseStatementsSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  opening_money_paise: money,
  accounts_added_opening_paise: money,
  receipts_paise: money,
  payments_paise: money,
  closing_money_paise: money,
  identity_matches: z.boolean(),
  accounts_added: z.array(
    z.object({
      account: z.string(),
      account_type: z.enum(['cash', 'bank', 'deposit']),
      opening_on: z.iso.date(),
      opening_balance_paise: money,
    }),
  ),
  receipt_heads: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      amount_paise: money,
    }),
  ),
  payment_heads: z.array(
    z.object({
      key: z.uuid(),
      label: z.string(),
      amount_paise: money,
    }),
  ),
  months: z.array(
    z.object({
      month: z.iso.date(),
      heads: z.array(
        z.object({
          kind: z.enum(['receipt', 'payment']),
          key: z.string(),
          label: z.string(),
          amount_paise: money,
        }),
      ),
    }),
  ),
  figures: z.object({
    average_monthly_expense_paise: money.nonnegative(),
    average_months: z.number().int().min(0).max(12),
    cash_cover_months: z.number().nullable(),
    category_shares: z.array(
      z.object({
        category: z.string(),
        expense_paise: money,
        share_percent: z.number().nullable(),
      }),
    ),
    comparison_from: z.iso.date(),
    comparison_to: z.iso.date(),
    income_change_percent: z.number().nullable(),
    expenditure_change_percent: z.number().nullable(),
  }),
});
export const expenseFinancialPositionSchema = z.object({
  as_of: z.iso.date(),
  billing_enabled: z.boolean(),
  vendor_enabled: z.boolean(),
  funds_enabled: z.boolean(),
  accounts: z.array(
    z.object({
      id: z.uuid(),
      account: z.string(),
      account_type: z.enum(['cash', 'bank', 'deposit']),
      active: z.boolean(),
      available: z.boolean(),
      balance_paise: money.nullable(),
    }),
  ),
  accounts_total_paise: money,
  funds: z.array(z.object({ fund: z.string(), balance_paise: money })),
  unallocated_paise: money.nullable(),
  member_dues_paise: money.nullable(),
  vendor_bills_paise: money.nullable(),
  fixed_deposits: z.array(
    z.object({
      bank_name: z.string(),
      reference: z.string().nullable(),
      principal_paise: money.nullable(),
      account_balance_paise: money.nullable(),
      maturity_on: z.iso.date(),
    }),
  ),
});
const multiYearHeadSchema = z.object({
  kind: z.enum(['receipt', 'payment']),
  key: z.string(),
  label: z.string(),
  amount_paise: money,
  change_percent: z.number().nullable(),
});
export const expenseMultiYearSchema = z.object({
  current_financial_year_start: z.iso.date(),
  books_started_on: z.iso.date().nullable(),
  years: z.array(
    z.object({
      financial_year_start: z.iso.date(),
      from: z.iso.date(),
      to: z.iso.date(),
      report_end: z.iso.date(),
      is_current: z.boolean(),
      not_available: z.boolean(),
      part_year: z.boolean(),
      income_paise: money,
      expense_paise: money,
      heads: z.array(multiYearHeadSchema),
    }),
  ),
});
const expenseAuditYearSchema = z.object({
  id: z.uuid(),
  auditor_name: z.string(),
  auditor_firm: z.string(),
  appointed_on: z.iso.date(),
  appointment_reference: z.string().nullable(),
  appointment_document_id: z.uuid().nullable(),
  report_received_on: z.iso.date().nullable(),
  placed_before_agm_on: z.iso.date().nullable(),
  filed_on: z.iso.date().nullable(),
  opinion: z
    .enum(['unmodified', 'qualified', 'adverse', 'disclaimer', 'other'])
    .nullable(),
  opinion_text: z.string().nullable(),
  version: z.number().int().positive(),
  updated_at: timestamp,
});
export const expenseAuditSchema = z.object({
  financial_year_start: z.iso.date(),
  can_manage: z.boolean(),
  warning_acknowledged_at: timestamp.nullable(),
  year: expenseAuditYearSchema.nullable(),
  queries: z.array(
    z.object({
      id: z.uuid(),
      query_number: z.number().int(),
      query_date: z.iso.date(),
      area: z.string(),
      question: z.string(),
      assignee_user_id: z.uuid(),
      assignee_name: z.string(),
      due_date: z.iso.date(),
      response: z.string().nullable(),
      response_date: z.iso.date().nullable(),
      status: z.enum(['open', 'answered', 'overdue']),
      version: z.number().int().positive(),
      updated_at: timestamp,
    }),
  ),
  objections: z.array(
    z.object({
      id: z.uuid(),
      description: z.string(),
      owner_user_id: z.uuid(),
      owner_name: z.string(),
      due_date: z.iso.date(),
      correction_note: z.string().nullable(),
      corrected_on: z.iso.date().nullable(),
      evidence_document_id: z.uuid().nullable(),
      status: z.enum(['open', 'overdue', 'resolved']),
      version: z.number().int().positive(),
      updated_at: timestamp,
    }),
  ),
  staff: z.array(z.object({ user_id: z.uuid(), full_name: z.string() })),
  documents: z.array(z.object({ id: z.uuid(), title: z.string() })),
  checks: z.array(
    z.object({
      key: z.enum([
        'months_closed',
        'bank_unmatched',
        'fixed_deposits',
        'petty_cash_count',
      ]),
      status: z.enum(['pass', 'attention']),
      detail: z.string(),
    }),
  ),
  revisions: z.array(
    z.object({
      id: z.uuid(),
      entity_type: z.enum(['audit_year', 'query', 'objection', 'agm_draft']),
      entity_id: z.uuid(),
      revision_number: z.number().int().positive(),
      created_at: timestamp,
      created_by_name: z.string(),
    }),
  ),
});
export const expenseAgmDraftSchema = z.object({
  financial_year_start: z.iso.date(),
  can_manage: z.boolean(),
  warning_acknowledged_at: timestamp.nullable(),
  sections: expenseAgmSectionsSchema,
  settings_updated_at: timestamp,
  draft: z
    .object({
      id: z.uuid(),
      written_sections: z.array(
        z.object({ title: z.string(), body: z.string() }),
      ),
      version: z.number().int().positive(),
      updated_at: timestamp,
    })
    .nullable(),
  revisions: z.array(
    z.object({
      id: z.uuid(),
      revision_number: z.number().int().positive(),
      created_at: timestamp,
      created_by_name: z.string(),
    }),
  ),
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

export const expenseCategoryDetailsInputSchema = z
  .object({
    categoryId: z.uuid(),
    detailGroup: z
      .string()
      .trim()
      .max(60)
      .transform((value) => value || null),
    costNature: z.enum(['fixed', 'variable', 'periodic']).nullable(),
    ownerUserId: z.uuid().nullable(),
    detailDescription: optionalText(500),
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict();

export const expensePayeeMappingInputSchema = z
  .object({
    payee: text(120),
    vendorId: z.uuid(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expensePayeeMappingRemoveInputSchema = z
  .object({
    mappingId: z.uuid(),
    reason: text(500),
    clientRequestId: z.uuid(),
  })
  .strict();
const vendorSpendFiltersSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    categoryId: z.uuid().nullable().optional(),
    group: optionalText(60).nullable().optional(),
    costNature: z.enum(['fixed', 'variable', 'periodic']).nullable().optional(),
  })
  .strict()
  .refine(
    ({ from, to }) =>
      from <= to &&
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000 <=
        731,
    'Choose a range of up to 24 months.',
  );
export const expenseVendorSpendInputSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  return {
    ...input,
    categoryId: input.categoryId || null,
    group: input.group || null,
    costNature: input.costNature || null,
  };
}, vendorSpendFiltersSchema);
export const expenseVendorSpendSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  vendor_enabled: z.boolean(),
  total_expense_paise: money,
  accounts_expense_paise: money,
  reconciles_to_accounts: z.boolean(),
  rows: z.array(
    z.object({
      key: z.string(),
      vendor_id: z.uuid().nullable(),
      vendor_name: z.string().nullable(),
      payee: z.string().nullable(),
      total_paise: money,
      share_bp: z.number().int(),
      high_share: z.boolean(),
      active_months: z.number().int().nonnegative(),
      average_per_active_month_paise: money,
      months: z.array(z.object({ month: z.iso.date(), amount_paise: money })),
      categories: z.array(
        z.object({
          category_id: z.uuid(),
          category_name: z.string(),
          amount_paise: money,
        }),
      ),
      approved_quote_paise: money.nullable(),
    }),
  ),
  mapping_suggestions: z.array(
    z.object({
      payee: z.string(),
      payee_key: z.string(),
      vendor_id: z.uuid(),
      vendor_name: z.string(),
    }),
  ),
  mappings: z.array(
    z.object({
      id: z.uuid(),
      payee_key: z.string(),
      vendor_id: z.uuid(),
      vendor_name: z.string(),
    }),
  ),
  vendors: z.array(z.object({ id: z.uuid(), name: z.string() })),
  categories: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      detail_group: z.string().nullable(),
      cost_nature: z.enum(['fixed', 'variable', 'periodic']).nullable(),
    }),
  ),
});

export const EXPENSE_SAVINGS_KINDS = [
  'renegotiation',
  'energy_saving',
  'reduced_consumption',
  'vendor_change',
  'process_change',
  'other',
] as const;
export const EXPENSE_SAVINGS_STATUSES = [
  'idea',
  'approved',
  'implementing',
  'realised',
  'dropped',
] as const;
export const expenseSavingsInputSchema = z
  .object({
    initiativeId: z.uuid().nullable(),
    title: text(120),
    description: text(4000),
    kind: z.enum(EXPENSE_SAVINGS_KINDS),
    ownerUserId: z.uuid().nullable(),
    categoryId: z.uuid().nullable(),
    vendorId: z.uuid().nullable(),
    baselineAnnualRupees: nonnegativeRupeesSchema,
    expectedAnnualRupees: nonnegativeRupeesSchema,
    expectedVersion: z.number().int().positive().nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.initiativeId === null && value.expectedVersion !== null) ||
      (value.initiativeId !== null && value.expectedVersion === null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh the initiative before editing.',
      });
    }
  });
export const expenseSavingsStatusInputSchema = z
  .object({
    initiativeId: z.uuid(),
    status: z.enum(EXPENSE_SAVINGS_STATUSES),
    reason: optionalText(500),
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const expenseSavingsEvidenceInputSchema = z
  .object({
    initiativeId: z.uuid(),
    amountRupees: rupeesSchema,
    evidencedOn: z.iso.date(),
    note: text(2000),
    entryId: z.uuid().nullable(),
    vendorBillId: z.uuid().nullable(),
    vendorContractId: z.uuid().nullable(),
    filePath: z.string().trim().max(500).nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    (value) =>
      Number(value.entryId !== null) +
        Number(value.vendorBillId !== null) +
        Number(value.vendorContractId !== null) <=
      1,
    { message: 'Choose at most one source link.' },
  );
export const expenseSavingsEvidenceVoidInputSchema = z
  .object({
    evidenceId: z.uuid(),
    reason: text(500),
    clientRequestId: z.uuid(),
  })
  .strict();

const expenseSavingsItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(EXPENSE_SAVINGS_KINDS),
  owner_user_id: z.uuid().nullable(),
  owner_name: z.string().nullable(),
  owner_is_current: z.boolean().nullable(),
  category_id: z.uuid().nullable(),
  category_name: z.string().nullable(),
  vendor_id: z.uuid().nullable(),
  vendor_name: z.string().nullable(),
  baseline_annual_paise: money.nonnegative(),
  expected_annual_paise: money.nonnegative(),
  status: z.enum(EXPENSE_SAVINGS_STATUSES),
  version: z.number().int().positive(),
  realised_to_date_paise: money.nonnegative(),
  updated_at: timestamp,
});
export const expenseSavingsListSchema = z.object({
  can_manage: z.boolean(),
  vendor_enabled: z.boolean(),
  initiatives: z.array(expenseSavingsItemSchema),
  staff: z.array(z.object({ user_id: z.uuid(), full_name: z.string() })),
  categories: z.array(z.object({ id: z.uuid(), name: z.string() })),
  vendors: z.array(z.object({ id: z.uuid(), name: z.string() })),
  source_choices: z.object({
    entries: z.array(z.object({ id: z.uuid(), label: z.string() })),
    vendor_bills: z.array(z.object({ id: z.uuid(), label: z.string() })),
    vendor_contracts: z.array(z.object({ id: z.uuid(), label: z.string() })),
  }),
});
export const expenseSavingsDetailSchema = expenseSavingsItemSchema
  .extend({
    created_at: timestamp,
    status_events: z.array(
      z.object({
        id: z.uuid(),
        from_status: z.enum(EXPENSE_SAVINGS_STATUSES),
        to_status: z.enum(EXPENSE_SAVINGS_STATUSES),
        reason: z.string().nullable(),
        created_at: timestamp,
        created_by_name: z.string(),
      }),
    ),
    evidence: z.array(
      z.object({
        id: z.uuid(),
        amount_paise: money.positive(),
        evidenced_on: z.iso.date(),
        note: z.string(),
        entry_id: z.uuid().nullable(),
        vendor_bill_id: z.uuid().nullable(),
        vendor_contract_id: z.uuid().nullable(),
        source_label: z.string().nullable(),
        file_path: z.string().nullable(),
        voided_at: timestamp.nullable(),
        void_reason: z.string().nullable(),
        created_at: timestamp,
        created_by_name: z.string(),
      }),
    ),
  })
  .strict();

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
export type ExpenseStatements = z.infer<typeof expenseStatementsSchema>;
export type ExpenseFinancialPosition = z.infer<
  typeof expenseFinancialPositionSchema
>;
export type ExpenseMultiYear = z.infer<typeof expenseMultiYearSchema>;
export type ExpenseAudit = z.infer<typeof expenseAuditSchema>;
export type ExpenseAgmDraft = z.infer<typeof expenseAgmDraftSchema>;
export type ExpenseVendorSpend = z.infer<typeof expenseVendorSpendSchema>;
export type ExpenseSavings = z.infer<typeof expenseSavingsListSchema>;
export type ExpenseSavingsDetail = z.infer<typeof expenseSavingsDetailSchema>;
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

export const expenseFundTargetInputSchema = z
  .object({
    fundId: z.uuid(),
    targetRupees: nonnegativeRupeesSchema.nullable(),
    targetDate: z.iso.date().nullable(),
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    (value) => value.targetDate === null || value.targetRupees !== null,
    'Set a target amount before setting a target date.',
  );

export const expenseStatementBalanceInputSchema = z
  .object({
    accountId: z.uuid(),
    month: z.iso
      .date()
      .refine(
        (value) => value.endsWith('-01'),
        'Choose the first day of a month.',
      ),
    closingRupees: signedRupeesSchema,
    note: optionalText(500),
    reason: optionalText(500),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.expectedUpdatedAt !== null &&
      (value.reason === null || value.reason.length < 5)
    )
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason for changing this statement balance.',
      });
  });

export const expenseFundReconciliationInputSchema = z
  .object({ month: z.iso.date() })
  .strict()
  .refine(
    ({ month }) => month.endsWith('-01'),
    'Choose the first day of a month.',
  );

const expenseFundReconciliationAccountSchema = z.object({
  account_id: z.uuid(),
  account_name: z.string(),
  account_type: z.literal('bank'),
  status: z.enum(['reconciled', 'needs_review']),
  reasons: z.array(
    z.enum([
      'month_not_closed',
      'opening_needs_review',
      'pending_suggested_splits',
      'fixed_deposits_need_review',
    ]),
  ),
  book_balance_paise: money,
  statement_closing_paise: money.nullable(),
  difference_paise: money.nullable(),
  note: z.string().nullable(),
  updated_at: timestamp.nullable(),
});

export const expenseFundReconciliationSchema = z.object({
  month: z.iso.date(),
  month_end: z.iso.date(),
  status: z.enum(['reconciled', 'needs_review']),
  reasons: z.array(
    z.enum([
      'month_not_closed',
      'opening_needs_review',
      'pending_suggested_splits',
      'fixed_deposits_need_review',
    ]),
  ),
  pending_suggested_splits: z.number().int().nonnegative(),
  accounts: z.array(expenseFundReconciliationAccountSchema),
  funds: z.array(
    z.object({
      fund_id: z.uuid(),
      fund_name: z.string(),
      active: z.boolean(),
      balance_paise: money,
      target_paise: money.nullable(),
      target_date: z.iso.date().nullable(),
      target_progress_bp: z.number().nullable(),
      target_gap_paise: money.nullable(),
      estimated_monthly_paise: money.nullable(),
      target_status: z
        .enum([
          'negative_balance',
          'below_target',
          'target_met',
          'behind_schedule',
        ])
        .nullable(),
      target_updated_at: timestamp,
    }),
  ),
});
export type ExpenseFundReconciliation = z.infer<
  typeof expenseFundReconciliationSchema
>;
