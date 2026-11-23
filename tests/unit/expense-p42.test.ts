// Verify P42 validation, report exports and evidence lifecycle inputs.
import { describe, expect, it } from 'vitest';
import {
  expenseCategoryDetailsInputSchema,
  expenseSavingsEvidenceInputSchema,
  expenseVendorSpendInputSchema,
  type ExpenseVendorSpend,
} from '../../src/core/expense/validation';
import {
  expenseVendorSpendCsv,
  expenseVendorSpendPdf,
} from '../../src/core/expense/documents';

describe('expense P42 controls', () => {
  it('normalises category details and requires an idempotency version', () => {
    const result = expenseCategoryDetailsInputSchema.parse({
      categoryId: '00000000-0000-4000-8000-000000000001',
      detailGroup: ' Maintenance ',
      costNature: 'variable',
      ownerUserId: null,
      detailDescription: ' ',
      expectedVersion: 2,
      clientRequestId: '00000000-0000-4000-8000-000000000002',
    });
    expect(result.detailGroup).toBe('Maintenance');
    expect(result.detailDescription).toBeNull();
    expect(
      expenseCategoryDetailsInputSchema.safeParse({
        ...result,
        expectedVersion: 0,
      }).success,
    ).toBe(false);
  });

  it('accepts at most 24 report months and preprocesses empty filters', () => {
    const parsed = expenseVendorSpendInputSchema.parse({
      from: '2026-04-01',
      to: '2028-03-31',
      categoryId: '',
      group: '',
      costNature: '',
    });
    expect(parsed).toMatchObject({
      categoryId: null,
      group: null,
      costNature: null,
    });
    expect(
      expenseVendorSpendInputSchema.safeParse({
        ...parsed,
        to: '2028-04-02',
      }).success,
    ).toBe(false);
  });

  it('allows only one evidence source link', () => {
    const input = {
      initiativeId: '00000000-0000-4000-8000-000000000010',
      amountRupees: '250.50',
      evidencedOn: '2026-06-01',
      note: 'Synthetic proof',
      entryId: '00000000-0000-4000-8000-000000000011',
      vendorBillId: '00000000-0000-4000-8000-000000000012',
      vendorContractId: null,
      filePath: null,
      clientRequestId: '00000000-0000-4000-8000-000000000013',
    };
    expect(expenseSavingsEvidenceInputSchema.safeParse(input).success).toBe(
      false,
    );
    expect(
      expenseSavingsEvidenceInputSchema.parse({
        ...input,
        vendorBillId: null,
      }).amountRupees,
    ).toBe(25050);
  });

  it('exports filtered vendor totals as CSV and PDF', async () => {
    const report: ExpenseVendorSpend = {
      from: '2026-04-01',
      to: '2026-05-31',
      vendor_enabled: true,
      total_expense_paise: 100000,
      accounts_expense_paise: 100000,
      reconciles_to_accounts: true,
      rows: [
        {
          key: 'vendor:synthetic',
          vendor_id: '00000000-0000-4000-8000-000000000020',
          vendor_name: 'Synthetic Vendor',
          payee: null,
          total_paise: 100000,
          share_bp: 10000,
          high_share: true,
          active_months: 1,
          average_per_active_month_paise: 100000,
          months: [{ month: '2026-05-01', amount_paise: 100000 }],
          categories: [
            {
              category_id: '00000000-0000-4000-8000-000000000021',
              category_name: 'Repairs',
              amount_paise: 100000,
            },
          ],
          approved_quote_paise: 120000,
        },
      ],
      mapping_suggestions: [],
      mappings: [],
      vendors: [],
      categories: [],
    };
    const csv = expenseVendorSpendCsv(report);
    expect(csv).toContain('Synthetic Vendor');
    expect(csv).toContain('1000.00,100.0,Reporting signal');
    const pdf = await expenseVendorSpendPdf('Synthetic Society', report);
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
  });
});
