// Verify exact paise conversion and shared billing setup validation.
import { describe, expect, it } from 'vitest';
import {
  billingSettingsSchema,
  billingFineInputSchema,
  billingWaiveInputSchema,
  billingPaymentConfirmInputSchema,
  billingPaymentRecordInputSchema,
  billingPaymentRejectInputSchema,
  billingPaymentSubmitInputSchema,
  billingPaymentSchema,
  chargeFormSchema,
  DEFAULT_BILLING_SETTINGS,
  paymentDetailsInputSchema,
  rupeesFromPaise,
  rupeesSchema,
} from '../../src/core/billing/validation';

describe('billing money and setup validation', () => {
  it.each([
    ['0.01', 1],
    ['1', 100],
    ['1.25', 125],
    ['001.20', 120],
    ['123456.78', 12345678],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('converts %s to exactly %i paise', (rupees, paise) => {
    expect(rupeesSchema.parse(rupees)).toBe(paise);
    expect(rupeesSchema.parse(rupeesFromPaise(paise))).toBe(paise);
  });

  it.each([
    '',
    '0',
    '-1',
    '1.001',
    '1e3',
    '1,000',
    'NaN',
    'Infinity',
    '90071992547409.92',
  ])('rejects invalid or unsafe monetary input %s', (input) =>
    expect(rupeesSchema.safeParse(input).success).toBe(false),
  );

  it('keeps formatting exact and rejects values that cannot safely represent paise', () => {
    expect(rupeesFromPaise(0)).toBe('0.00');
    expect(rupeesFromPaise(101)).toBe('1.01');
    expect(() => rupeesFromPaise(1.5)).toThrow(RangeError);
    expect(() => rupeesFromPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      RangeError,
    );
  });

  it('requires an amount for fixed and per-square-foot charges, and none for custom', () => {
    const form = {
      id: null,
      name: ' Monthly maintenance ',
      method: 'fixed',
      amountRupees: '1234.56',
      active: true,
      expectedUpdatedAt: null,
    };
    expect(chargeFormSchema.parse(form)).toMatchObject({
      name: 'Monthly maintenance',
      amountPaise: 123456,
    });
    expect(
      chargeFormSchema.parse({
        ...form,
        method: 'per_sqft',
        amountRupees: '1.25',
      }).amountPaise,
    ).toBe(125);
    expect(
      chargeFormSchema.parse({ ...form, method: 'custom', amountRupees: '' })
        .amountPaise,
    ).toBeNull();
    expect(
      chargeFormSchema.safeParse({ ...form, amountRupees: '' }).success,
    ).toBe(false);
    expect(
      chargeFormSchema.safeParse({ ...form, method: 'custom' }).success,
    ).toBe(false);
    expect(
      chargeFormSchema.safeParse({ ...form, societyId: 'untrusted' }).success,
    ).toBe(false);
  });

  it('validates payment identifiers without accepting unrelated or browser-supplied ownership', () => {
    const input = {
      upiId: ' homeish-test@example ',
      payeeName: ' Test Society ',
      qrPath: null,
      expectedUpdatedAt: null,
    };
    expect(paymentDetailsInputSchema.parse(input)).toMatchObject({
      upiId: 'homeish-test@example',
      payeeName: 'Test Society',
    });
    for (const upiId of [
      'not-a-upi-id',
      'a@b',
      'name@',
      '@bank',
      'name @bank',
      'name@/bank',
      '.@bank',
    ]) {
      expect(
        paymentDetailsInputSchema.safeParse({ ...input, upiId }).success,
      ).toBe(false);
    }
    expect(
      paymentDetailsInputSchema.safeParse({ ...input, actorId: 'untrusted' })
        .success,
    ).toBe(false);
  });

  it('keeps late fees off by default and enforces the approved percentage precision and cap', () => {
    expect(DEFAULT_BILLING_SETTINGS.late_fee).toBeNull();
    expect(billingSettingsSchema.parse({})).toEqual({});
    expect(
      billingSettingsSchema.parse({
        late_fee: { type: 'percent', value: 2.5 },
        reminders: { before_due_days: 3, on_due: true, overdue_every_days: 7 },
      }).late_fee,
    ).toEqual({ type: 'percent', value: 2.5 });
    for (const value of [0, -1, 0.001, 2.555, 100.01, Infinity]) {
      expect(
        billingSettingsSchema.safeParse({
          late_fee: { type: 'percent', value },
        }).success,
      ).toBe(false);
    }
    expect(
      billingSettingsSchema.safeParse({
        late_fee: { type: 'flat', value: 1.5 },
      }).success,
    ).toBe(false);
    expect(
      billingSettingsSchema.safeParse({ due_day_of_month: 32 }).success,
    ).toBe(false);
    expect(billingSettingsSchema.safeParse({ grace_days: -1 }).success).toBe(
      false,
    );
    expect(
      billingSettingsSchema.safeParse({ pending_confirmation_alert_days: 0 })
        .success,
    ).toBe(false);
    expect(
      billingSettingsSchema.safeParse({
        reminders: { before_due_days: 3, on_due: true, overdue_every_days: 0 },
      }).success,
    ).toBe(false);
    expect(
      billingSettingsSchema.safeParse({ upi_id: 'homeish-test@example' })
        .success,
    ).toBe(false);
  });

  it('validates resident payment submissions and converts rupees exactly', () => {
    const request = {
      unitId: '00000000-0000-4000-8000-000000000001',
      amountRupees: '123.45',
      reference: ' abc123456 ',
      paidOn: '2027-02-01',
      proofPath: null,
      clientRequestId: '00000000-0000-4000-8000-000000000002',
    };
    expect(billingPaymentSubmitInputSchema.parse(request)).toMatchObject({
      amount_paise: 12345,
      reference: 'ABC123456',
      paid_on: '2027-02-01',
    });

    expect(
      billingPaymentSubmitInputSchema.safeParse({
        ...request,
        amountRupees: '1.001',
      }).success,
    ).toBe(false);
    expect(
      billingPaymentSubmitInputSchema.safeParse({
        ...request,
        reference: 'bad ref',
      }).success,
    ).toBe(false);
    expect(
      billingPaymentSubmitInputSchema.safeParse({
        ...request,
        unitId: 'another-unit',
      }).success,
    ).toBe(false);
  });

  it('accepts payment records without unit labels in RPC results', () => {
    expect(
      billingPaymentSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        unit_id: '00000000-0000-4000-8000-000000000002',
        amount_paise: 100,
        mode: 'upi',
        source: 'resident_submitted',
        reference: 'ABC123',
        paid_on: '2027-02-01',
        status: 'awaiting_confirmation',
        submitted_by: '00000000-0000-4000-8000-000000000003',
        confirmed_by: null,
        confirmed_at: null,
        rejected_at: null,
        reject_reason: null,
        receipt_no: null,
        proof_path: null,
        created_at: '2027-02-01T00:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('validates admin-recorded payment modes and confirm/reject inputs', () => {
    const input = {
      unitId: '00000000-0000-4000-8000-000000000001',
      amountRupees: '50.00',
      mode: 'cash',
      reference: '',
      paidOn: '2027-02-01',
      clientRequestId: '00000000-0000-4000-8000-000000000002',
    };
    expect(billingPaymentRecordInputSchema.parse(input)).toMatchObject({
      amount_paise: 5000,
      reference: null,
      mode: 'cash',
    });
    expect(
      billingPaymentRecordInputSchema.safeParse({
        ...input,
        mode: 'cash',
        reference: 'CASH123',
      }).success,
    ).toBe(false);
    expect(
      billingPaymentRecordInputSchema.safeParse({
        ...input,
        mode: 'cheque',
        reference: 'CHK123456',
      }).success,
    ).toBe(true);
    expect(
      billingPaymentConfirmInputSchema.parse({
        paymentId: input.clientRequestId,
        correctedAmountRupees: '49.99',
      }).corrected_amount_paise,
    ).toBe(4999);
    expect(
      billingPaymentConfirmInputSchema.parse({
        paymentId: input.clientRequestId,
        correctedAmountRupees: '',
      }).corrected_amount_paise,
    ).toBeNull();
    expect(
      billingPaymentRejectInputSchema.safeParse({
        paymentId: input.clientRequestId,
        reason: '  ',
      }).success,
    ).toBe(false);
  });
});

describe('billing fine and waiver validation', () => {
  const unitId = '5b696d6f-774c-41d1-ae47-6254d4a8f4cf';
  const billId = '6c696d6f-774c-41d1-ae47-6254d4a8f4cf';

  it('requires a positive fine amount and a reason', () => {
    expect(
      billingFineInputSchema.parse({
        unitId,
        amountRupees: ' 250.50 ',
        reason: 'Parking violation',
        fineDate: '2026-11-05',
      }),
    ).toEqual({
      unit_id: unitId,
      amount_paise: 25050,
      reason: 'Parking violation',
      fine_date: '2026-11-05',
    });
    for (const amountRupees of ['', '0', '-1', 'abc']) {
      expect(
        billingFineInputSchema.safeParse({
          unitId,
          amountRupees,
          reason: 'Parking violation',
          fineDate: '2026-11-05',
        }).success,
      ).toBe(false);
    }
  });

  it('treats a blank waiver amount as the full outstanding amount', () => {
    expect(
      billingWaiveInputSchema.parse({
        billId,
        amountRupees: '',
        reason: 'Committee approved',
        cancel: false,
      }),
    ).toEqual({
      bill_id: billId,
      amount_paise: null,
      reason: 'Committee approved',
      cancel: false,
    });
    expect(
      billingWaiveInputSchema.parse({
        billId,
        amountRupees: '100',
        reason: 'Committee approved',
        cancel: false,
      }).amount_paise,
    ).toBe(10000);
  });

  it('rejects cancellation with a partial amount or a missing reason', () => {
    expect(
      billingWaiveInputSchema.safeParse({
        billId,
        amountRupees: '100',
        reason: 'Duplicate bill',
        cancel: true,
      }).success,
    ).toBe(false);
    expect(
      billingWaiveInputSchema.safeParse({
        billId,
        amountRupees: '',
        reason: ' ',
        cancel: true,
      }).success,
    ).toBe(false);
  });
});
