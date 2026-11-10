// Verify billing CSV safety, PDF rendering, display formatting and notification links.
import { describe, expect, it } from 'vitest';
import {
  exportFileName,
  pdfSafeText,
  renderBillPdf,
  renderReceiptPdf,
  toCsv,
} from '../../src/core/billing/documents';
import {
  billDisplayStatus,
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
  isUuid,
  todayInTimeZone,
} from '../../src/core/billing/format';
import {
  billingBillDetailsSchema,
  billingReceiptSchema,
  exportJobSchema,
} from '../../src/core/billing/validation';
import { notificationPath } from '../../src/core/notifications/links';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '5b696d6f-774c-41d1-ae47-6254d4a8f4cf';
const billId = '6c696d6f-774c-41d1-ae47-6254d4a8f4cf';
const paymentId = '7d696d6f-774c-41d1-ae47-6254d4a8f4cf';

const receipt = billingReceiptSchema.parse({
  payment_id: paymentId,
  receipt_no: 'R-2026-000001',
  amount_paise: 350000,
  mode: 'upi',
  source: 'resident_submitted',
  reference: 'UTR123456',
  paid_on: '2026-11-05',
  confirmed_at: '2026-11-06T04:30:00.000Z',
  unit_id: unitId,
  unit_number: 'A-101',
  unit_label: 'Flat',
  society_name: 'Synthetic Greens Society',
  society_address: '1 Example Road, Pune',
  timezone: 'Asia/Kolkata',
  payer_name: 'Résident Example',
  confirmed_by_name: 'Admin Example',
  allocations: [
    {
      bill_id: billId,
      title: 'Maintenance Nov 2026',
      period_start: '2026-11-01',
      due_date: '2026-11-10',
      amount_paise: 300000,
    },
  ],
});

const bill = billingBillDetailsSchema.parse({
  id: billId,
  unit_id: unitId,
  kind: 'regular',
  title: 'Maintenance Nov 2026',
  period_start: '2026-11-01',
  due_date: '2026-11-10',
  total_paise: 300000,
  paid_paise: 0,
  waived_paise: 0,
  status: 'due',
  cancelled_at: null,
  outstanding_paise: 300000,
  society_id: societyId,
  related_bill_id: null,
  cancelled_by: null,
  cancel_reason: null,
  created_at: '2026-11-01T00:00:00.000Z',
  created_by: null,
  unit_number: 'A-101',
  unit_label: 'Flat',
  society_name: 'Synthetic Greens Society',
  society_address: '1 Example Road, Pune',
  lines: [
    {
      id: paymentId,
      charge_type_id: null,
      description: 'Maintenance – ₹ fixed',
      amount_paise: 300000,
    },
  ],
});

function pdfHeader(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.slice(0, 5));
}

describe('billing documents', () => {
  it('neutralizes spreadsheet formulas and quotes CSV cells', () => {
    expect(
      toCsv(
        ['unit', 'note', 'amount'],
        [
          ['=HYPERLINK("x")', 'said "hi", ok', 1200],
          ['+1', '@cmd', null],
          ['-2', '\tTab', 0],
        ],
      ),
    ).toBe(
      'unit,note,amount\r\n' +
        `"'=HYPERLINK(""x"")","said ""hi"", ok",1200\r\n` +
        "'+1,'@cmd,\r\n" +
        "'-2,'\tTab,0\r\n",
    );
  });

  it('names exports from the report and date range', () => {
    const job = exportJobSchema.parse({
      id: paymentId,
      society_id: societyId,
      created_at: '2026-11-06T04:30:00.000Z',
      summary: {
        module: 'billing',
        report: 'dues_by_unit',
        from: '2026-11-01',
        to: '2026-11-30',
        row_count: 0,
        columns: [],
        rows: [],
      },
    });
    expect(exportFileName(job)).toBe(
      'homeish-dues-by-unit-2026-11-01-to-2026-11-30.csv',
    );
  });

  it('keeps PDF text within the standard font character set', () => {
    expect(pdfSafeText('Résident – ₹ 100')).toBe('Resident ? ? 100');
  });

  it('renders receipt and bill PDFs with non-ASCII input', async () => {
    expect(pdfHeader(await renderReceiptPdf(receipt))).toBe('%PDF-');
    expect(pdfHeader(await renderBillPdf(bill))).toBe('%PDF-');
  });
});

describe('billing formatting', () => {
  it('formats dates, periods and rupees consistently', () => {
    expect(formatBillingDate('2026-11-05')).toBe('05 Nov 2026');
    expect(formatBillingPeriod('2026-11-01')).toBe('Nov 2026');
    expect(formatRupees(123456)).toBe('Rs. 1234.56');
    expect(formatRupees('5')).toBe('Rs. 0.05');
  });

  it('flags open bills past their due date as overdue', () => {
    expect(billDisplayStatus(bill, '2026-11-10')).toBe('bill.due');
    expect(billDisplayStatus(bill, '2026-11-11')).toBe('bill.overdue');
    expect(billDisplayStatus({ ...bill, status: 'paid' }, '2026-12-01')).toBe(
      'bill.paid',
    );
  });

  it('uses the society time zone for today', () => {
    const instant = new Date('2026-11-09T19:00:00.000Z');
    expect(todayInTimeZone('Asia/Kolkata', instant)).toBe('2026-11-10');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-11-09');
  });

  it('accepts only UUID route parameters', () => {
    expect(isUuid(billId)).toBe(true);
    expect(isUuid('../etc')).toBe(false);
  });
});

describe('notification links', () => {
  const always = () => true;

  it('routes billing notifications to the matching screen', () => {
    expect(notificationPath('billing_bill', billId, always)).toBe(
      `/bills/${billId}`,
    );
    expect(notificationPath('billing_payment', paymentId, always)).toBe(
      '/bills?tab=payments',
    );
    expect(notificationPath('billing_payment_review', null, always)).toBe(
      '/admin/billing?tab=payments',
    );
  });

  it('drops unknown types and rejected identifiers', () => {
    expect(notificationPath('unknown', billId, always)).toBeNull();
    expect(notificationPath('billing_bill', 'x', () => false)).toBeNull();
    expect(notificationPath('billing_bill', null, always)).toBeNull();
  });
});
