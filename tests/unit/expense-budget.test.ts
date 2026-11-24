// Verify P42.5 budget phasing and closed change inputs.
import { describe, expect, it } from 'vitest';
import {
  expenseBudgetChangeInputSchema,
  expenseBudgetDraftInputSchema,
  spreadExpenseBudgetAmount,
} from '../../src/core/expense/budget-validation';
import {
  expenseBudgetCsv,
  expenseBudgetPdf,
} from '../../src/core/expense/documents';

describe('expense budgets', () => {
  it('spreads whole rupees and puts the remainder in the last receiving month', () => {
    expect(spreadExpenseBudgetAmount(100_000, 'equal_monthly')).toEqual([
      8300, 8300, 8300, 8300, 8300, 8300, 8300, 8300, 8300, 8300, 8300, 8700,
    ]);
    expect(spreadExpenseBudgetAmount(100_000, 'quarterly')).toEqual([
      25000, 0, 0, 25000, 0, 0, 25000, 0, 0, 25000, 0, 0,
    ]);
    expect(spreadExpenseBudgetAmount(10_000, 'first_month')).toEqual([
      10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('accepts custom months only when they set the yearly amount', () => {
    const months = Array.from({ length: 12 }, () => '0');
    months[0] = '1000.00';
    const input = {
      financialYear: 2026,
      lines: [
        {
          categoryId: '00000000-0000-4000-8000-000000000001',
          incomeType: null,
          annualRupees: '1000.00',
          phasing: 'custom',
          monthRupees: months,
        },
      ],
      copySourceYear: null,
      copyPercent: null,
      expectedVersion: null,
      clientRequestId: '00000000-0000-4000-8000-000000000002',
    };
    const parsed = expenseBudgetDraftInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(
      expenseBudgetDraftInputSchema.safeParse({
        ...input,
        lines: [{ ...input.lines[0], annualRupees: '999.00' }],
      }).success,
    ).toBe(false);
  });

  it('requires one source and a distinct destination for a move', () => {
    const valid = {
      budgetId: '00000000-0000-4000-8000-000000000010',
      changeKind: 'move',
      categoryId: '00000000-0000-4000-8000-000000000011',
      incomeType: null,
      toCategoryId: '00000000-0000-4000-8000-000000000012',
      toIncomeType: null,
      amountRupees: '2500.00',
      effectiveMonth: 4,
      reason: 'Move within the approved plan',
      approvedBody: 'committee',
      approvedOn: '2026-07-01',
      approvalMeetingId: null,
      approvalDocumentId: null,
      approvalNote: '',
      expectedVersion: 2,
      clientRequestId: '00000000-0000-4000-8000-000000000013',
    };
    expect(expenseBudgetChangeInputSchema.safeParse(valid).success).toBe(true);
    expect(
      expenseBudgetChangeInputSchema.safeParse({
        ...valid,
        toCategoryId: valid.categoryId,
      }).success,
    ).toBe(false);
  });

  it('exports a formula-safe CSV and a readable PDF snapshot', async () => {
    const report = {
      financial_year: 2026,
      from: '2026-04-01',
      to: '2027-03-31',
      as_of: '2026-11-23',
      approved: true,
      forecast_method: 'budget' as const,
      months_averaged: 0,
      summary: [
        {
          category_id: '00000000-0000-4000-8000-000000000030',
          income_type: null,
          name: '=Untrusted head',
          kind: 'spending' as const,
          budgeted: true,
          original_paise: 120000,
          changes_paise: 0,
          current_paise: 120000,
          plan_to_date_paise: 80000,
          actual_to_date_paise: 60000,
          difference_paise: 20000,
          difference_label: 'Below budget' as const,
          percent_used_bp: 7500,
          burn_rate_bp: 7500,
          warning: 'on_track' as const,
          projected_year_end_paise: 90000,
          projected_overrun_paise: null,
          projection_available: true,
        },
      ],
      months: [],
      cash_flow: [],
      opening_money_paise: 100000,
      accounts_added_opening_paise: 0,
    };
    const csv = expenseBudgetCsv(report);
    expect(csv).toContain(`'=Untrusted head`);
    expect(csv).toContain('Burn rate / used (%)');
    expect(csv).toContain('On track');
    expect(csv).toContain('900');
    expect(csv).toContain('Estimate');
    const pdf = await expenseBudgetPdf('Synthetic Society', report);
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
  });
});
