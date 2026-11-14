// Produce formula-safe inventory reports with exact fractional usage totals.
import { z } from 'zod';
import { toCsv } from '../csv/serialize';
import {
  formatStockQuantity,
  quantityThousandths,
  type InventoryItem,
  type InventoryTransaction,
} from './validation';

export const inventoryReportKindSchema = z.enum([
  'stock',
  'usage',
  'low_stock',
  'transactions',
]);
export function inventoryReportCsv(
  kind: z.infer<typeof inventoryReportKindSchema>,
  items: readonly InventoryItem[],
  transactions: readonly InventoryTransaction[],
): string {
  if (kind === 'transactions')
    return toCsv(
      [
        'Date',
        'Item',
        'Type',
        'Quantity',
        'Unit',
        'Vendor',
        'Purpose / reason',
        'Cost (paise)',
      ],
      transactions.map((row) => [
        row.effective_date,
        row.item_name,
        row.kind,
        row.quantity,
        row.unit_of_measure,
        row.vendor,
        row.purpose,
        row.cost_paise,
      ]),
    );
  if (kind === 'usage')
    return toCsv(
      ['Item', 'Unit', 'Issued quantity'],
      items.map((item) => [
        item.name,
        item.unit_of_measure,
        formatStockQuantity(
          transactions
            .filter((row) => row.item_id === item.id && row.kind === 'out')
            .reduce(
              (total, row) => total - quantityThousandths(row.quantity),
              BigInt(0),
            ),
        ),
      ]),
    );
  return toCsv(
    [
      'Item',
      'Category',
      'Unit',
      'Current stock',
      'Minimum stock',
      'Active',
      'Low stock',
    ],
    items
      .filter((item) => kind !== 'low_stock' || item.low_stock)
      .map((item) => [
        item.name,
        item.category,
        item.unit_of_measure,
        item.stock,
        item.minimum_stock,
        item.active ? 'Yes' : 'No',
        item.low_stock ? 'Yes' : 'No',
      ]),
  );
}
