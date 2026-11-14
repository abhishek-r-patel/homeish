// Verify exact fractional stock input and signed adjustment validation.
import { describe, expect, it } from 'vitest';
import {
  quantityThousandths,
  stockTransactionInputSchema,
  inventoryItemSchema,
} from '../../src/core/housekeeping/validation';
import { inventoryReportCsv } from '../../src/core/housekeeping/reports';
import type {
  InventoryItem,
  InventoryTransaction,
} from '../../src/core/housekeeping/validation';

const stockIn = {
  itemId: '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
  kind: 'in',
  quantity: '0.125',
  effectiveDate: '2026-11-14',
  vendor: 'Synthetic vendor',
  purpose: null,
  costRupees: '1.25',
  clientRequestId: '8a696d6f-774c-41d1-ae47-6254d4a8f4cf',
};

describe('inventory input', () => {
  it('preserves thousandths and converts receipt costs to paise exactly', () => {
    const value = stockTransactionInputSchema.parse(stockIn);
    expect(quantityThousandths(value.quantity)).toBe(BigInt(125));
    expect(value.costRupees).toBe(125);
    expect(quantityThousandths('-1.005')).toBe(BigInt(-1005));
    expect(
      stockTransactionInputSchema.parse({ ...stockIn, costRupees: '0' })
        .costRupees,
    ).toBe(0);
  });

  it('rejects malformed, zero, overprecision and negative receipt quantities', () => {
    for (const quantity of [
      'bad',
      '0',
      '0.000',
      '1.0001',
      '-1',
      '10000000000000',
      '1e3',
    ]) {
      expect(
        stockTransactionInputSchema.safeParse({ ...stockIn, quantity }).success,
      ).toBe(false);
    }
  });

  it('requires a reason and no purchase cost for signed adjustments', () => {
    const adjustment = {
      ...stockIn,
      kind: 'adjustment',
      quantity: '-0.125',
      costRupees: '',
    };
    expect(stockTransactionInputSchema.safeParse(adjustment).success).toBe(
      false,
    );
    expect(
      stockTransactionInputSchema.safeParse({
        ...adjustment,
        purpose: 'Correct stock count',
      }).success,
    ).toBe(true);
    expect(
      stockTransactionInputSchema.safeParse({
        ...adjustment,
        purpose: 'Correct stock count',
        costRupees: '10',
      }).success,
    ).toBe(false);
  });

  it('adds fractional usage exactly and neutralizes user-entered CSV formulas', () => {
    const item: InventoryItem = {
      id: stockIn.itemId,
      name: '=Untrusted',
      unit_of_measure: 'litres',
      category: 'cleaning',
      minimum_stock: '1.000',
      stock: '1.000',
      active: true,
      updated_at: '2026-11-14T00:00:00.000Z',
      low_stock: true,
    };
    const transaction: InventoryTransaction = {
      id: stockIn.clientRequestId,
      item_id: item.id,
      item_name: item.name,
      unit_of_measure: item.unit_of_measure,
      kind: 'out',
      quantity: '-0.100',
      effective_date: stockIn.effectiveDate,
      vendor: null,
      purpose: 'Used',
      cost_paise: null,
    };
    const csv = inventoryReportCsv(
      'usage',
      [item],
      [transaction, { ...transaction, quantity: '-0.200' }],
    );
    expect(csv).toContain("'=Untrusted,litres,0.300\r\n");
    const accumulated = inventoryItemSchema.parse({
      ...item,
      stock: '10000000000000.125',
    });
    expect(quantityThousandths(accumulated.stock)).toBe(
      BigInt('10000000000000125'),
    );
    expect(
      inventoryReportCsv('low_stock', [{ ...item, low_stock: false }], []),
    ).not.toContain('Untrusted');
  });
});
