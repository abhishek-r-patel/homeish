// Validate exact inventory quantities, immutable stock requests and report rows.
import { z } from 'zod';
import { nonnegativeRupeesSchema } from '../billing/validation';

export const stockQuantitySchema = z
  .string()
  .trim()
  .max(20)
  .regex(
    /^-?\d{1,13}(?:\.\d{1,3})?$/,
    'Enter a quantity with at most three decimal places.',
  );

export function quantityThousandths(value: string): bigint {
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(value)) {
    throw new RangeError('Invalid exact inventory quantity.');
  }
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const magnitude =
    BigInt(whole!) * BigInt(1000) + BigInt(fraction.padEnd(3, '0'));
  return negative ? -magnitude : magnitude;
}

export function formatStockQuantity(value: bigint): string {
  const magnitude = value < BigInt(0) ? -value : value;
  const whole = magnitude / BigInt(1000);
  const fraction = (magnitude % BigInt(1000)).toString().padStart(3, '0');
  return `${value < BigInt(0) ? '-' : ''}${whole}.${fraction}`;
}

const category = z.enum(['cleaning', 'tools', 'consumables', 'other']);
const nullableText = (max: number) =>
  z.string().trim().min(1).max(max).nullable();
export const inventoryItemInputSchema = z
  .object({
    itemId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(120),
    unitOfMeasure: z.string().trim().min(1).max(30),
    category,
    minimumStock: stockQuantitySchema.refine(
      (value) => !value.startsWith('-'),
      'The minimum stock cannot be negative.',
    ),
    active: z.boolean(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();

export const stockTransactionInputSchema = z
  .object({
    itemId: z.uuid(),
    kind: z.enum(['in', 'out', 'adjustment']),
    quantity: stockQuantitySchema,
    effectiveDate: z.iso.date(),
    vendor: nullableText(120),
    purpose: nullableText(500),
    costRupees: z.union([
      z.literal('').transform(() => null),
      nonnegativeRupeesSchema,
    ]),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!stockQuantitySchema.safeParse(value.quantity).success) return;
    const quantity = quantityThousandths(value.quantity);
    if (
      quantity === BigInt(0) ||
      (value.kind !== 'adjustment' && quantity < BigInt(0))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Enter a positive quantity, or a nonzero signed adjustment.',
      });
    }
    if (value.kind !== 'in' && value.purpose === null) {
      context.addIssue({
        code: 'custom',
        path: ['purpose'],
        message: 'Provide the issue purpose or adjustment reason.',
      });
    }
    if (value.kind !== 'in' && value.costRupees !== null) {
      context.addIssue({
        code: 'custom',
        path: ['costRupees'],
        message: 'Costs belong only to stock-in receipts.',
      });
    }
  });

export const inventoryItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    unit_of_measure: z.string(),
    category,
    minimum_stock: stockQuantitySchema,
    stock: z.string().regex(/^\d+(?:\.\d{1,3})?$/),
    active: z.boolean(),
    updated_at: z.iso.datetime({ offset: true }),
    low_stock: z.boolean(),
  })
  .strict();
export const inventoryTransactionSchema = z
  .object({
    id: z.uuid(),
    item_id: z.uuid(),
    item_name: z.string(),
    unit_of_measure: z.string(),
    kind: z.enum(['in', 'out', 'adjustment']),
    quantity: stockQuantitySchema,
    effective_date: z.iso.date(),
    vendor: z.string().nullable(),
    purpose: z.string().nullable(),
    cost_paise: z.string().regex(/^\d+$/).nullable(),
  })
  .strict();
export const inventoryReportRangeSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    itemId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    ({ from, to }) => from <= to,
    'The report start date must not follow its end date.',
  );

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>;
