// Validate the P43.2 monthly collection report and the P43.3 admin dues follow-up list, and build their CSVs (client-safe).
import { z } from 'zod';
import { toCsv } from '../csv/serialize';
import { REPORT_PERIODS } from '../analytics/report-period';
import { rupeesFromPaise } from './validation';

const isoDate = z.iso.date();
const paiseText = z.string().regex(/^\d+$/);
const count = z.number().int().nonnegative();

export const billingMonthlyCollectionRowSchema = z.object({
  month: isoDate,
  bill_count: count,
  billed_paise: paiseText,
  waived_paise: paiseText,
  net_billed_paise: paiseText,
  collected_paise: paiseText,
  collection_percent: z.number().min(0).max(100).nullable(),
});

export const billingMonthlyCollectionSchema = z.object({
  today: isoDate,
  rows: z.array(billingMonthlyCollectionRowSchema).max(24),
});

export type BillingMonthlyCollection = z.infer<
  typeof billingMonthlyCollectionSchema
>;
export type BillingMonthlyCollectionRow = z.infer<
  typeof billingMonthlyCollectionRowSchema
>;

export const billingDuesFollowUpRowSchema = z.object({
  unit_id: z.uuid(),
  unit_number: z.string().min(1),
  name: z.string().nullable(),
  relationship: z.enum(['owner', 'tenant']).nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  outstanding_paise: paiseText,
  oldest_due_date: isoDate,
  months_overdue: count,
  last_payment_on: isoDate.nullable(),
  last_payment_paise: paiseText.nullable(),
  awaiting_confirmation: z.boolean(),
});

export const billingDuesFollowUpSchema = z.object({
  today: isoDate,
  rows: z.array(billingDuesFollowUpRowSchema),
});

export type BillingDuesFollowUp = z.infer<typeof billingDuesFollowUpSchema>;
export type BillingDuesFollowUpRow = z.infer<
  typeof billingDuesFollowUpRowSchema
>;

export const billingMonthlyCollectionExportInputSchema = z
  .object({ period: z.enum(REPORT_PERIODS) })
  .strict();

// Totals use the same rule as each month: collected divided by net billed, or no percentage when nothing is billed.
export function billingMonthlyCollectionTotals(
  rows: readonly BillingMonthlyCollectionRow[],
) {
  const sum = (
    key:
      'billed_paise' | 'waived_paise' | 'net_billed_paise' | 'collected_paise',
  ) => rows.reduce((total, row) => total + BigInt(row[key]), BigInt(0));
  const net = sum('net_billed_paise');
  const collected = sum('collected_paise');
  return {
    bill_count: rows.reduce((total, row) => total + row.bill_count, 0),
    billed_paise: sum('billed_paise').toString(),
    waived_paise: sum('waived_paise').toString(),
    net_billed_paise: net.toString(),
    collected_paise: collected.toString(),
    collection_percent:
      net === BigInt(0)
        ? null
        : Number((collected * BigInt(1000) + net / BigInt(2)) / net) / 10,
  };
}

function percentCell(value: number | null) {
  return value === null ? '' : value.toFixed(1);
}

export function billingMonthlyCollectionCsv(
  rows: readonly BillingMonthlyCollectionRow[],
) {
  const totals = billingMonthlyCollectionTotals(rows);
  return toCsv(
    [
      'Bill month',
      'Bills',
      'Billed (Rs.)',
      'Waived (Rs.)',
      'Net billed (Rs.)',
      'Collected (Rs.)',
      'Collected %',
    ],
    [...rows, { month: 'Total', ...totals }].map((row) => [
      row.month === 'Total' ? 'Total' : row.month.slice(0, 7),
      row.bill_count,
      rupeesFromPaise(row.billed_paise),
      rupeesFromPaise(row.waived_paise),
      rupeesFromPaise(row.net_billed_paise),
      rupeesFromPaise(row.collected_paise),
      percentCell(row.collection_percent),
    ]),
  );
}

export function billingDuesFollowUpCsv(
  rows: readonly BillingDuesFollowUpRow[],
) {
  return toCsv(
    [
      'Unit',
      'Name',
      'Relationship',
      'Phone',
      'Email',
      'Outstanding (Rs.)',
      'Oldest due date',
      'Months overdue',
      'Last payment date',
      'Last payment (Rs.)',
      'Payment awaiting confirmation',
    ],
    rows.map((row) => [
      row.unit_number,
      row.name,
      row.relationship,
      row.phone,
      row.email,
      rupeesFromPaise(row.outstanding_paise),
      row.oldest_due_date,
      row.months_overdue,
      row.last_payment_on,
      row.last_payment_paise === null
        ? null
        : rupeesFromPaise(row.last_payment_paise),
      row.awaiting_confirmation ? 'Yes' : 'No',
    ]),
  );
}
