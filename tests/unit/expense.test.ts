// Verify expense input rules, default periods, P39 reconciliation and petty-cash inputs and exports.
import { describe, expect, it } from 'vitest';
import {
  cashCountInputSchema,
  cashDifferenceKind,
  expenseAccountInputSchema,
  expenseAgmDraftInputSchema,
  expenseAuditObjectionInputSchema,
  expenseAuditYearInputSchema,
  expenseDecisionInputSchema,
  expenseFinancialYearStart,
  expenseFundActivationInputSchema,
  expenseFundAllocationInputSchema,
  expenseFundAllocationCorrectionInputSchema,
  expenseFundInputSchema,
  expenseFundMappingInputSchema,
  expenseFundOpeningCorrectionInputSchema,
  expenseFixedDepositInputSchema,
  expenseMonthCloseInputSchema,
  expenseRangeOrDefault,
  expenseRangeSchema,
  pettyCashAssignInputSchema,
  statementItemCancelInputSchema,
  statementItemInputSchema,
  expenseTransferInputSchema,
  expenseTransferReverseInputSchema,
  expenseFundTransferInputSchema,
  expenseFundTransferRuleInputSchema,
  expenseFundCorpusInputSchema,
  expenseFundWorkInputSchema,
  type ExpenseEntry,
  type ExpenseReport,
  type ExpenseStatements,
} from '../../src/core/expense/validation';
import {
  expenseEntriesCsv,
  expenseReportPdf,
  expenseStatementsCsv,
  expenseStatementsPdf,
  formatSignedRupees,
} from '../../src/core/expense/documents';

const id = '11111111-1111-4111-8111-111111111111';
const entry: ExpenseEntry = {
  id,
  entry_date: '2026-05-04',
  direction: 'in',
  amount_paise: 250_000,
  source: 'billing_payment',
  transfer_pair_id: null,
  transfer_account_name: null,
  account_id: id,
  account_name: 'Main bank',
  category_name: null,
  income_kind: null,
  counterparty: 'A-101',
  reference: 'R-2026-000001',
  description: null,
  expense_id: null,
  receipt_path: null,
  reverses_entry_id: null,
  reversed_by_entry_id: null,
  month_closed: false,
  voucher_no: 'RV/2026-27/1',
  running_balance_paise: null,
};

describe('expense validation', () => {
  it('accepts signed opening balances and rejects malformed amounts', () => {
    const base = {
      accountId: null,
      expectedUpdatedAt: null,
      name: 'Main bank',
      accountType: 'bank',
      openingOn: '2026-04-01',
      active: true,
    };
    expect(
      expenseAccountInputSchema.parse({
        ...base,
        openingBalanceRupees: '-1500.50',
      }).openingBalanceRupees,
    ).toBe(-150_050);
    expect(
      expenseAccountInputSchema.safeParse({
        ...base,
        openingBalanceRupees: '12.345',
      }).success,
    ).toBe(false);
    expect(
      expenseAccountInputSchema.safeParse({
        ...base,
        accountId: id,
        openingBalanceRupees: '0',
      }).success,
    ).toBe(false);
  });

  it('accepts deposit accounts and paired own-account transfers only', () => {
    expect(
      expenseAccountInputSchema.parse({
        accountId: null,
        expectedUpdatedAt: null,
        name: 'Fixed deposit',
        accountType: 'deposit',
        openingOn: '2026-04-01',
        openingBalanceRupees: '0',
        active: true,
      }).accountType,
    ).toBe('deposit');
    expect(
      expenseTransferInputSchema.safeParse({
        fromAccountId: id,
        toAccountId: id,
        transferOn: '2026-05-04',
        amountRupees: '100',
        reference: '',
        note: '',
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      expenseTransferReverseInputSchema.safeParse({
        transferPairId: id,
        reverseOn: '2026-05-04',
        reason: ' ',
        clientRequestId: id,
      }).success,
    ).toBe(false);
  });

  it('validates bank-confirmed deposits and leaves unknown figures null', () => {
    expect(
      expenseFixedDepositInputSchema.parse({
        depositId: null,
        predecessorId: null,
        fundId: id,
        accountId: null,
        bankName: '  Society bank  ',
        reference: ' ',
        principalRupees: null,
        quotedRate: null,
        depositOn: '2026-04-01',
        maturityOn: '2027-04-01',
        maturityValueRupees: null,
        expectedUpdatedAt: null,
      }),
    ).toMatchObject({
      bankName: 'Society bank',
      reference: null,
      principalRupees: null,
      quotedRate: null,
    });

    expect(
      expenseFixedDepositInputSchema.safeParse({
        depositId: null,
        predecessorId: null,
        fundId: id,
        accountId: id,
        bankName: 'Society bank',
        reference: 'FD-1',
        principalRupees: '100',
        quotedRate: '7.2500',
        depositOn: '2026-04-01',
        maturityOn: '2026-03-31',
        maturityValueRupees: '107.25',
        expectedUpdatedAt: null,
      }).success,
    ).toBe(false);
  });

  it('requires configured fund pairs, reasons and different funds', () => {
    expect(
      expenseFundTransferRuleInputSchema.safeParse({
        ruleId: null,
        fromFundId: id,
        toFundId: id,
        active: true,
        expectedUpdatedAt: null,
      }).success,
    ).toBe(false);
    expect(
      expenseFundTransferInputSchema.safeParse({
        fromFundId: id,
        toFundId: '22222222-2222-4222-8222-222222222222',
        transferOn: '2026-05-04',
        amountRupees: '100',
        reason: ' ',
        decisionReference: 'Resolution-1',
        clientRequestId: id,
      }).success,
    ).toBe(false);
  });

  it('requires a reason only for a used corpus concession', () => {
    expect(
      expenseFundCorpusInputSchema.safeParse({
        recordId: null,
        unitId: id,
        fundId: id,
        eventDescription: 'Transfer event',
        eventOn: '2026-05-01',
        reportedAmountRupees: '100',
        concessionRupees: '10',
        concessionReason: null,
        decisionReference: 'Resolution-2',
        expectedUpdatedAt: null,
      }).success,
    ).toBe(false);
    expect(
      expenseFundCorpusInputSchema.parse({
        recordId: null,
        unitId: id,
        fundId: id,
        eventDescription: 'Transfer event',
        eventOn: '2026-05-01',
        reportedAmountRupees: '100',
        concessionRupees: '0',
        concessionReason: null,
        decisionReference: 'Resolution-2',
        expectedUpdatedAt: null,
      }).reportedAmountRupees,
    ).toBe(10000);
  });

  it('requires one authority source for sanctioned work', () => {
    expect(
      expenseFundWorkInputSchema.safeParse({
        workId: null,
        fundId: id,
        title: 'Lift repair',
        sanctionedAmountRupees: '50000',
        sanctionedOn: '2026-05-01',
        validUntil: null,
        meetingResolutionId: id,
        externalReference: 'Resolution-4',
        expectedUpdatedAt: null,
      }).success,
    ).toBe(false);
  });

  it('requires a rejection reason, month starts and ranges up to two years', () => {
    expect(
      expenseDecisionInputSchema.safeParse({
        expenseId: id,
        approve: false,
        note: '  ',
      }).success,
    ).toBe(false);
    expect(
      expenseDecisionInputSchema.safeParse({
        expenseId: id,
        approve: true,
        note: '',
      }).success,
    ).toBe(true);
    expect(
      expenseMonthCloseInputSchema.safeParse({ month: '2026-04-02' }).success,
    ).toBe(false);
    expect(
      expenseRangeSchema.safeParse({ from: '2024-04-01', to: '2026-04-01' })
        .success,
    ).toBe(true);
    expect(
      expenseRangeSchema.safeParse({ from: '2024-04-01', to: '2026-04-03' })
        .success,
    ).toBe(false);
    expect(
      expenseRangeSchema.safeParse({ from: '2026-05-02', to: '2026-05-01' })
        .success,
    ).toBe(false);
  });

  it('defaults views to the April–March financial year to date', () => {
    expect(expenseFinancialYearStart('2026-03-31')).toBe('2025-04-01');
    expect(expenseFinancialYearStart('2026-04-01')).toBe('2026-04-01');
    expect(expenseRangeOrDefault({ from: 'bad' }, '2026-07-15')).toEqual({
      from: '2026-04-01',
      to: '2026-07-15',
    });
    expect(
      expenseRangeOrDefault(
        { from: '2026-05-01', to: '2026-05-31' },
        '2026-07-15',
      ),
    ).toEqual({ from: '2026-05-01', to: '2026-05-31' });
  });

  it('requires fund versions and acknowledged month-start openings', () => {
    expect(
      expenseFundInputSchema.safeParse({
        fundId: id,
        expectedUpdatedAt: null,
        name: 'Repairs',
        active: true,
      }).success,
    ).toBe(false);
    expect(
      expenseFundInputSchema.parse({
        fundId: null,
        expectedUpdatedAt: null,
        name: '  Major repairs  ',
        active: true,
      }).name,
    ).toBe('Major repairs');
    expect(
      expenseFundActivationInputSchema.safeParse({
        cutoverOn: '2026-05-02',
        allocations: [{ fundId: id, amountRupees: '100' }],
        acknowledged: true,
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      expenseFundActivationInputSchema.safeParse({
        cutoverOn: '2026-05-01',
        allocations: [{ fundId: id, amountRupees: '100' }],
        acknowledged: false,
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      expenseFundActivationInputSchema.parse({
        cutoverOn: '2026-05-01',
        allocations: [{ fundId: id, amountRupees: '100.50' }],
        acknowledged: true,
        clientRequestId: id,
      }).allocations[0]?.amountRupees,
    ).toBe(10_050);
  });

  it('validates suggestion mappings and bounded allocation batches', () => {
    expect(
      expenseFundMappingInputSchema.parse({
        sourceKind: 'expense_category',
        sourceId: id,
        incomeKind: null,
        fundId: id,
        expectedUpdatedAt: null,
      }).sourceId,
    ).toBe(id);
    expect(
      expenseFundMappingInputSchema.safeParse({
        sourceKind: 'income_kind',
        sourceId: id,
        incomeKind: null,
        fundId: id,
        expectedUpdatedAt: null,
      }).success,
    ).toBe(false);
    expect(
      expenseFundAllocationInputSchema
        .parse({
          items: [
            {
              entryId: id,
              allocations: [
                { fundId: id, amountRupees: '25.50' },
                { fundId: null, amountRupees: '4.50' },
              ],
            },
          ],
          clientRequestId: id,
        })
        .items[0]?.allocations.map(({ amountRupees }) => amountRupees),
    ).toEqual([2550, 450]);
    expect(
      expenseFundAllocationInputSchema.safeParse({
        items: [],
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      expenseFundAllocationCorrectionInputSchema.safeParse({
        entryId: id,
        allocations: [{ fundId: id, amountRupees: '25' }],
        reason: ' ',
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      expenseFundOpeningCorrectionInputSchema.parse({
        allocations: [{ fundId: id, amountRupees: '0' }],
        reason: '  Bank reconciliation completed  ',
        clientRequestId: id,
      }).reason,
    ).toBe('Bank reconciliation completed');
  });
});

describe('P39 accounts additions', () => {
  it('converts statement and count rupees to paise and keeps optional text empty as null', () => {
    const item = statementItemInputSchema.parse({
      accountId: id,
      statementDate: '2026-05-04',
      reference: ' ',
      party: 'Water board',
      direction: 'out',
      amountRupees: '1200.50',
      clientRequestId: id,
    });
    expect(item.amountRupees).toBe(120_050);
    expect(item.reference).toBeNull();
    expect(
      statementItemInputSchema.safeParse({ ...item, amountRupees: '0' })
        .success,
    ).toBe(false);
    expect(
      statementItemCancelInputSchema.safeParse({ itemId: id, reason: ' ' })
        .success,
    ).toBe(false);
    expect(
      cashCountInputSchema.parse({
        countDate: '2026-05-04',
        countedRupees: '0',
        note: '',
        clientRequestId: id,
      }).countedRupees,
    ).toBe(0);
    expect(
      pettyCashAssignInputSchema.parse({
        accountId: id,
        custodianUserId: id,
        handoverCountRupees: null,
        handoverNote: '',
        clientRequestId: id,
      }).handoverCountRupees,
    ).toBeNull();
  });

  it('describes a count difference as over, short or matching', () => {
    expect(cashDifferenceKind(4_000)).toBe('over');
    expect(cashDifferenceKind(-12_000)).toBe('short');
    expect(cashDifferenceKind(0)).toBe('matches');
  });
});

describe('expense exports', () => {
  it('writes entries with separate in and out columns', () => {
    const csv = expenseEntriesCsv([
      entry,
      {
        ...entry,
        id: '22222222-2222-4222-8222-222222222222',
        direction: 'out',
        source: 'expense',
        category_name: 'Repairs',
        counterparty: '=HYPERLINK("x")',
        amount_paise: 100,
      },
    ]);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain('In (Rs.),Out (Rs.)');
    expect(lines[0]).toMatch(/^Date,Voucher,/);
    expect(lines[1]).toContain('RV/2026-27/1');
    expect(lines[1]).toContain('Maintenance collection');
    expect(lines[1]).toContain('Maintenance collections');
    expect(lines[2]).toContain('Repairs');
    expect(lines[2]).not.toMatch(/,=HYPERLINK/);
    expect(formatSignedRupees(-150_050)).toMatch(/^-Rs\. 1,?500\.50$/);
  });

  it('renders a multi-section summary PDF', async () => {
    const report: ExpenseReport = {
      from: '2026-04-01',
      to: '2026-05-31',
      income_paise: 250_000,
      expense_paise: 100,
      months: [
        {
          month: '2026-05-01',
          income_paise: 250_000,
          expense_paise: 100,
          net_paise: 249_900,
          cumulative_net_paise: 249_900,
        },
      ],
      categories: [{ category: 'Repairs', expense_paise: 100 }],
      income_sources: [{ source: 'billing', income_paise: 250_000 }],
      balances: [
        {
          account: 'Main bank',
          account_type: 'bank',
          active: true,
          balance_paise: -5_000,
        },
      ],
      billing_enabled: true,
      outstanding_dues_paise: 900_000,
    };
    const pdf = await expenseReportPdf('Green Acres', report, [entry]);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('requires P41 audit references, paired opinions and paired corrections', () => {
    const year = {
      yearId: null,
      financialYearStart: '2026-04-01',
      auditorName: 'Synthetic Auditor',
      auditorFirm: 'Synthetic Firm',
      appointedOn: '2026-04-20',
      appointmentReference: 'Resolution 1',
      appointmentDocumentId: null,
      reportReceivedOn: null,
      placedBeforeAgmOn: null,
      filedOn: null,
      opinion: null,
      opinionText: null,
      expectedVersion: null,
      clientRequestId: id,
    };
    expect(expenseAuditYearInputSchema.safeParse(year).success).toBe(true);
    expect(
      expenseAuditYearInputSchema.safeParse({
        ...year,
        appointmentReference: null,
      }).success,
    ).toBe(false);
    expect(
      expenseAuditYearInputSchema.safeParse({
        ...year,
        opinion: 'qualified',
      }).success,
    ).toBe(false);
    expect(
      expenseAuditObjectionInputSchema.safeParse({
        objectionId: null,
        auditYearId: id,
        description: 'Synthetic objection',
        ownerUserId: id,
        dueDate: '2026-05-20',
        correctionNote: 'Corrected from the bank statement.',
        correctedOn: null,
        evidenceDocumentId: null,
        expectedVersion: null,
        clientRequestId: id,
      }).success,
    ).toBe(false);
  });

  it('caps AGM drafts and produces safe statement exports', async () => {
    expect(
      expenseAgmDraftInputSchema.safeParse({
        draftId: null,
        financialYearStart: '2026-04-01',
        writtenSections: Array.from({ length: 11 }, (_, index) => ({
          title: `Section ${index}`,
          body: 'Synthetic text.',
        })),
        expectedVersion: null,
        clientRequestId: id,
      }).success,
    ).toBe(false);
    const statements: ExpenseStatements = {
      from: '2026-04-01',
      to: '2026-04-30',
      opening_money_paise: 100_000,
      accounts_added_opening_paise: 0,
      receipts_paise: 25_000,
      payments_paise: 10_000,
      closing_money_paise: 115_000,
      identity_matches: true,
      accounts_added: [],
      receipt_heads: [
        { key: '=unsafe', label: '=unsafe', amount_paise: 25_000 },
      ],
      payment_heads: [],
      months: [
        {
          month: '2026-04-01',
          heads: [
            {
              kind: 'receipt',
              key: '=unsafe',
              label: '=unsafe',
              amount_paise: 25_000,
            },
          ],
        },
      ],
      figures: {
        average_monthly_expense_paise: 10_000,
        average_months: 1,
        cash_cover_months: 11.5,
        category_shares: [],
        comparison_from: '2025-04-01',
        comparison_to: '2025-04-30',
        income_change_percent: null,
        expenditure_change_percent: null,
      },
    };
    expect(expenseStatementsCsv(statements)).toContain("'=unsafe");
    const pdf = await expenseStatementsPdf('Green Acres', statements);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });
});
