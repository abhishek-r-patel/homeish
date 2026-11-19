// Verify expense input rules, default periods, P39 reconciliation and petty-cash inputs and exports.
import { describe, expect, it } from 'vitest';
import {
  cashCountInputSchema,
  cashDifferenceKind,
  expenseAccountInputSchema,
  expenseDecisionInputSchema,
  expenseFinancialYearStart,
  expenseMonthCloseInputSchema,
  expenseRangeOrDefault,
  expenseRangeSchema,
  pettyCashAssignInputSchema,
  statementItemCancelInputSchema,
  statementItemInputSchema,
  type ExpenseEntry,
  type ExpenseReport,
} from '../../src/core/expense/validation';
import {
  expenseEntriesCsv,
  expenseReportPdf,
  formatSignedRupees,
} from '../../src/core/expense/documents';

const id = '11111111-1111-4111-8111-111111111111';
const entry: ExpenseEntry = {
  id,
  entry_date: '2026-05-04',
  direction: 'in',
  amount_paise: 250_000,
  source: 'billing_payment',
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
});
