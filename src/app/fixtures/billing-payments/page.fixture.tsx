// Exercise UPI payment submission and admin review with in-memory synthetic data.
'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaymentReviewQueue } from '@/components/billing/admin-panels';
import { BillingPayForm } from '@/components/billing/pay-form';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import type { ServerActionResult } from '@/core/actions/server-action';
import { formatRupees } from '@/core/billing/format';
import {
  billingPaymentConfirmInputSchema,
  billingPaymentRejectInputSchema,
  billingPaymentSubmitInputSchema,
  type BillingPayment,
} from '@/core/billing/validation';
import { publicEnvironment } from '@/core/config/public-env';

const unitId = '0f8f5a3e-9f43-4d0e-8e8c-7d3b0c9a1e21';
const residentId = '5d0c1f6e-3a2b-4c8d-9e7f-1a2b3c4d5e6f';
const today = '2026-11-20';

const stalePayment: BillingPayment = {
  id: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  unit_id: unitId,
  unit_number: 'A-101',
  amount_paise: 150000,
  mode: 'upi',
  source: 'resident_submitted',
  reference: 'OLDREF123456',
  paid_on: '2026-11-10',
  status: 'awaiting_confirmation',
  submitted_by: residentId,
  submitted_by_name: 'Synthetic Resident',
  confirmed_by: null,
  confirmed_at: null,
  rejected_at: null,
  reject_reason: null,
  receipt_no: null,
  proof_path: null,
  created_at: '2026-11-10T09:00:00.000Z',
};

function validationFailure(fieldErrors: Record<string, string>) {
  return {
    ok: false as const,
    code: 'VALIDATION_FAILED' as const,
    message: 'Check the highlighted fields.',
    fieldErrors,
  };
}

function Fixture() {
  const params = useSearchParams();
  const [pending, setPending] = useState<BillingPayment[]>([stalePayment]);
  const [history, setHistory] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);
  const failSubmit = params.get('fail') === 'submit';

  async function submitAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    if (failSubmit) {
      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'The synthetic payment could not be submitted.',
        referenceId: 'fixture-reference',
      };
    }
    const parsed = billingPaymentSubmitInputSchema.safeParse(
      JSON.parse(String(formData.get('input'))),
    );
    if (!parsed.success) {
      return validationFailure(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === 'reference'
              ? 'Enter 6 to 30 letters or numbers.'
              : 'Enter a valid positive amount.',
          ]),
        ),
      );
    }
    const input = parsed.data;
    if (pending.some(({ reference }) => reference === input.reference)) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'This UPI reference has already been submitted.',
      };
    }
    setPending((current) => [
      ...current,
      {
        ...stalePayment,
        id: input.client_request_id,
        amount_paise: input.amount_paise,
        reference: input.reference,
        paid_on: input.paid_on,
        proof_path: input.proof_path,
        created_at: `${today}T08:00:00.000Z`,
      },
    ]);
    return { ok: true, message: 'Synthetic payment details submitted.' };
  }

  async function confirmAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    const parsed = billingPaymentConfirmInputSchema.safeParse(
      JSON.parse(String(formData.get('input'))),
    );
    if (!parsed.success) {
      return validationFailure({
        correctedAmountRupees: 'Enter a valid positive amount.',
      });
    }
    const payment = pending.find(({ id }) => id === parsed.data.payment_id);
    if (!payment) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'This payment is no longer awaiting confirmation.',
      };
    }
    const amount = parsed.data.corrected_amount_paise ?? payment.amount_paise;
    const receipt = `RCPT-FIX-${String(receiptCount + 1).padStart(4, '0')}`;
    setReceiptCount((count) => count + 1);
    setPending((current) => current.filter(({ id }) => id !== payment.id));
    setHistory((current) => [
      ...current,
      `Confirmed ${payment.reference} for ${formatRupees(amount)} · receipt ${receipt}`,
    ]);
    return { ok: true, message: `Synthetic payment confirmed. ${receipt}.` };
  }

  async function rejectAction(
    formData: FormData,
  ): Promise<ServerActionResult<unknown>> {
    const parsed = billingPaymentRejectInputSchema.safeParse(
      JSON.parse(String(formData.get('input'))),
    );
    if (!parsed.success) {
      return validationFailure({ reason: 'Enter a reason.' });
    }
    const payment = pending.find(({ id }) => id === parsed.data.payment_id);
    setPending((current) =>
      current.filter(({ id }) => id !== parsed.data.payment_id),
    );
    setHistory((current) => [
      ...current,
      `Rejected ${payment?.reference ?? 'payment'}: ${parsed.data.reason}`,
    ]);
    return { ok: true, message: 'Synthetic payment rejected.' };
  }

  return (
    <main
      className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink"
      data-storage-origin={
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      }
    >
      <Banner title="Synthetic payments fixture" tone="info">
        Development-only in-memory data. This UPI ID cannot receive money. No
        money moves and no database records are written. Reload to reset.
      </Banner>
      <section aria-labelledby="fixture-resident" className="grid gap-space-4">
        <h1 className="text-title font-semibold" id="fixture-resident">
          Pay maintenance
        </h1>
        <BillingPayForm
          details={{
            upi_id: 'homeish-fixture@example',
            payee_name: 'Synthetic Society',
            updated_at: '2026-11-10T12:00:00.000Z',
          }}
          initialAmountPaise={null}
          initialUnitId={unitId}
          key={formKey}
          onSubmitted={() => setFormKey((key) => key + 1)}
          qrUrl={null}
          resubmitReason={
            params.get('resubmit') === '1'
              ? 'The UPI reference did not match the bank statement.'
              : null
          }
          submitAction={submitAction}
          timezone="Asia/Kolkata"
          today={today}
          unitLabel="Flat"
          units={[{ id: unitId, number: 'A-101', outstandingPaise: 250000 }]}
        />
      </section>
      <section aria-labelledby="fixture-admin" className="grid gap-space-4">
        <h2 className="text-heading font-semibold" id="fixture-admin">
          Payments awaiting confirmation
        </h2>
        <PaymentReviewQueue
          canManage={params.get('role') !== 'committee'}
          confirmAction={confirmAction}
          payments={pending}
          rejectAction={rejectAction}
          staleDays={7}
          today={today}
        />
        <Card title="Review history">
          {history.length === 0 ? (
            <p className="text-body text-ink-muted">No reviews yet.</p>
          ) : (
            <ul aria-label="Review history" className="grid gap-space-2">
              {history.map((entry) => (
                <li className="text-body" key={entry}>
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </main>
  );
}

export default function BillingPaymentsFixturePage() {
  return (
    <Suspense fallback={<p>Loading payments fixture...</p>}>
      <Fixture />
    </Suspense>
  );
}
