// Admin billing interactions: bill adjustments, payment review, fines and exports.
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, StatusChip } from '@/components/ui/data-display';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  addBillingFineAction,
  confirmBillingPaymentAction,
  exportBillingReportAction,
  recordBillingPaymentAction,
  rejectBillingPaymentAction,
  waiveBillingBillAction,
} from '@/app/(admin)/admin/billing/actions';
import { formatBillingDate, formatRupees } from '@/core/billing/format';
import type {
  BillingBillDetails,
  BillingPayment,
  BillingReport,
} from '@/core/billing/validation';
import {
  ActionResult,
  type BillingFormAction,
  fieldError,
  useBillingAction,
} from './action-state';
import { textLinkClass } from './styles';

type UnitOption = { id: string; number: string };

export function BillAdminActions({ bill }: { bill: BillingBillDetails }) {
  const waive = useBillingAction(waiveBillingBillAction);
  const cancel = useBillingAction(waiveBillingBillAction);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const open = bill.status === 'due' || bill.status === 'partially_paid';
  if (!open) return null;
  const canCancel = bill.status === 'due' && bill.paid_paise === 0;

  return (
    <Card title="Adjust bill">
      <div className="grid gap-space-4">
        <p className="text-body text-ink-muted">
          Waive part or all of the outstanding balance, or cancel a bill that
          has no payments. A reason is required and recorded in the audit log.
        </p>
        <ActionResult result={waive.result ?? cancel.result} />
        <div className="flex flex-wrap gap-space-3">
          <Button
            onClick={() => {
              waive.reset();
              setWaiveOpen(true);
            }}
            variant="secondary"
          >
            Waive Amount
          </Button>
          {canCancel ? (
            <Button
              onClick={() => {
                cancel.reset();
                setCancelOpen(true);
              }}
              variant="destructive"
            >
              Cancel Bill
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog
        closeDisabled={waive.pending}
        id="billing-waive"
        onOpenChange={setWaiveOpen}
        open={waiveOpen}
        title="Waive bill amount"
      >
        <form
          className="grid gap-space-4"
          onSubmit={(event) => {
            event.preventDefault();
            waive.run(
              {
                billId: bill.id,
                amountRupees: amount,
                reason,
                cancel: 'false',
              },
              () => {
                setWaiveOpen(false);
                setAmount('');
                setReason('');
              },
            );
          }}
        >
          <p className="text-body">
            Outstanding: {formatRupees(bill.outstanding_paise)}
          </p>
          <AmountInput
            error={fieldError(waive.result, 'amountRupees', 'amount_paise')}
            helpText="Leave blank to waive the full outstanding amount."
            id="billing-waive-amount"
            label="Amount to waive"
            onChange={(event) => setAmount(event.currentTarget.value)}
            value={amount}
          />
          <TextAreaInput
            error={fieldError(waive.result, 'reason')}
            id="billing-waive-reason"
            label="Reason"
            maxLength={500}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
            value={reason}
          />
          {waive.result && !waive.result.ok ? (
            <ActionResult result={waive.result} />
          ) : null}
          <div className="flex justify-end gap-space-3">
            <Button
              disabled={waive.pending}
              onClick={() => setWaiveOpen(false)}
              variant="secondary"
            >
              Close
            </Button>
            <Button loading={waive.pending} type="submit">
              Apply Waiver
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        actionLabel="Cancel Bill"
        description={`Cancel ${bill.title} for ${bill.unit_label} ${bill.unit_number}? The bill total is reversed in the ledger.`}
        error={
          cancel.result && !cancel.result.ok ? cancel.result.message : undefined
        }
        id="billing-cancel"
        loading={cancel.pending}
        onConfirm={(value) =>
          cancel.run(
            {
              billId: bill.id,
              amountRupees: '',
              reason: value ?? '',
              cancel: 'true',
            },
            () => setCancelOpen(false),
          )
        }
        onOpenChange={setCancelOpen}
        open={cancelOpen}
        requiresReason
        title="Cancel bill"
      />
    </Card>
  );
}

function daysSince(timestamp: string, today: string) {
  const start = Date.parse(timestamp.slice(0, 10));
  const end = Date.parse(today);
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function ProofLink({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  return (
    <span className="inline-flex items-center gap-space-2">
      <button
        className={textLinkClass}
        disabled={state === 'loading'}
        onClick={() => {
          setState('loading');
          const popup = window.open('', '_blank');
          if (popup) popup.opener = null;
          void fetch('/api/files/url', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bucket: 'payment-proofs', path }),
          })
            .then(
              (response) =>
                response.json() as Promise<{
                  ok?: boolean;
                  data?: { signedUrl?: string };
                }>,
            )
            .then((result) => {
              const url = result.data?.signedUrl;
              if (!result.ok || !url) throw new Error('No URL');
              if (popup) popup.location.href = url;
              else window.location.assign(url);
              setState('idle');
            })
            .catch(() => {
              popup?.close();
              setState('error');
            });
        }}
        type="button"
      >
        {state === 'loading' ? 'Opening…' : 'View Screenshot'}
      </button>
      {state === 'error' ? (
        <span className="text-caption text-danger" role="alert">
          Could not open the screenshot.
        </span>
      ) : null}
    </span>
  );
}

type ReviewActions = {
  confirmAction?: BillingFormAction<unknown>;
  rejectAction?: BillingFormAction<unknown>;
};

function ReviewCard({
  canManage,
  confirmAction,
  payment,
  rejectAction,
  staleDays,
  today,
}: ReviewActions & {
  canManage: boolean;
  payment: BillingPayment;
  staleDays: number;
  today: string;
}) {
  const confirm = useBillingAction<unknown>(
    confirmAction ?? confirmBillingPaymentAction,
  );
  const reject = useBillingAction<unknown>(
    rejectAction ?? rejectBillingPaymentAction,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [corrected, setCorrected] = useState('');
  const age = daysSince(payment.created_at, today);
  const stale = age >= staleDays;

  return (
    <li className="grid gap-space-3 rounded-md border border-rule bg-surface p-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <p className="text-body-strong">
            {payment.unit_number ?? 'Unit'} ·{' '}
            {formatRupees(payment.amount_paise)}
          </p>
          <p className="text-caption text-ink-muted">
            UPI ref. {payment.reference ?? '—'} · paid{' '}
            {formatBillingDate(payment.paid_on)}
            {payment.submitted_by_name
              ? ` · by ${payment.submitted_by_name}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-2">
          {stale ? (
            <span className="rounded-sm border border-warning bg-warning-tint px-space-2 text-caption text-warning">
              Waiting {age} day{age === 1 ? '' : 's'}
            </span>
          ) : null}
          <StatusChip status="payment.awaiting_confirmation" />
        </div>
      </div>
      {payment.proof_path ? <ProofLink path={payment.proof_path} /> : null}
      <ActionResult result={confirm.result ?? reject.result} />
      {canManage ? (
        <div className="flex flex-wrap gap-space-3">
          <Button
            onClick={() => {
              confirm.reset();
              setConfirmOpen(true);
            }}
            variant="success"
          >
            Confirm
          </Button>
          <Button
            onClick={() => {
              reject.reset();
              setRejectOpen(true);
            }}
            variant="secondary"
          >
            Reject
          </Button>
        </div>
      ) : null}
      <Dialog
        closeDisabled={confirm.pending}
        id={`billing-confirm-${payment.id}`}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Confirm payment"
      >
        <form
          className="grid gap-space-4"
          onSubmit={(event) => {
            event.preventDefault();
            confirm.run(
              {
                input: JSON.stringify({
                  paymentId: payment.id,
                  correctedAmountRupees: corrected.trim() || null,
                }),
              },
              () => setConfirmOpen(false),
            );
          }}
        >
          <p className="text-body">
            Confirm {formatRupees(payment.amount_paise)} from{' '}
            {payment.unit_number ?? 'this unit'} after checking the bank or UPI
            statement. A receipt is issued and the oldest bills are settled
            first.
          </p>
          <AmountInput
            error={fieldError(confirm.result, 'correctedAmountRupees')}
            helpText="Only if the amount received differs from the submitted amount."
            id={`billing-confirm-amount-${payment.id}`}
            label="Corrected amount (optional)"
            onChange={(event) => setCorrected(event.currentTarget.value)}
            value={corrected}
          />
          {confirm.result && !confirm.result.ok ? (
            <ActionResult result={confirm.result} />
          ) : null}
          <div className="flex justify-end gap-space-3">
            <Button
              disabled={confirm.pending}
              onClick={() => setConfirmOpen(false)}
              variant="secondary"
            >
              Close
            </Button>
            <Button loading={confirm.pending} type="submit" variant="success">
              Confirm Payment
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        actionLabel="Reject Payment"
        description="The resident sees this reason and can resubmit with corrected details."
        error={
          reject.result && !reject.result.ok ? reject.result.message : undefined
        }
        id={`billing-reject-${payment.id}`}
        loading={reject.pending}
        onConfirm={(reason) =>
          reject.run(
            {
              input: JSON.stringify({
                paymentId: payment.id,
                reason: reason ?? '',
              }),
            },
            () => setRejectOpen(false),
          )
        }
        onOpenChange={setRejectOpen}
        open={rejectOpen}
        requiresReason
        title="Reject payment"
      />
    </li>
  );
}

export function PaymentReviewQueue({
  canManage,
  confirmAction,
  payments,
  rejectAction,
  staleDays,
  today,
}: ReviewActions & {
  canManage: boolean;
  payments: readonly BillingPayment[];
  staleDays: number;
  today: string;
}) {
  if (payments.length === 0) {
    return (
      <p className="text-body text-ink-muted" role="status">
        No payments are waiting for confirmation.
      </p>
    );
  }
  return (
    <ul
      aria-label="Payments awaiting confirmation"
      className="grid gap-space-3"
    >
      {payments.map((payment) => (
        <ReviewCard
          canManage={canManage}
          confirmAction={confirmAction}
          key={payment.id}
          payment={payment}
          rejectAction={rejectAction}
          staleDays={staleDays}
          today={today}
        />
      ))}
    </ul>
  );
}

const MODE_OPTIONS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Bank transfer', value: 'bank_transfer' },
  { label: 'UPI', value: 'upi' },
];

function unitOptions(units: readonly UnitOption[]) {
  return units.map((unit) => ({ label: unit.number, value: unit.id }));
}

export function RecordPaymentButton({
  today,
  units,
}: {
  today: string;
  units: readonly UnitOption[];
}) {
  const record = useBillingAction(recordBillingPaymentAction);
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  function reset() {
    setUnitId('');
    setAmount('');
    setMode('cash');
    setReference('');
    setPaidOn(today);
    setRequestId(crypto.randomUUID());
  }

  return (
    <>
      <Button
        onClick={() => {
          record.reset();
          setOpen(true);
        }}
      >
        Record Payment
      </Button>
      {record.result?.ok ? <ActionResult result={record.result} /> : null}
      <Dialog
        closeDisabled={record.pending}
        id="billing-record-payment"
        onOpenChange={setOpen}
        open={open}
        title="Record offline payment"
      >
        <form
          className="grid gap-space-4"
          onSubmit={(event) => {
            event.preventDefault();
            record.run(
              {
                input: JSON.stringify({
                  unitId,
                  amountRupees: amount,
                  mode,
                  reference: mode === 'cash' ? '' : reference,
                  paidOn,
                  clientRequestId: requestId,
                }),
              },
              () => {
                setOpen(false);
                reset();
              },
            );
          }}
        >
          <SelectInput
            error={fieldError(record.result, 'unitId')}
            id="billing-record-unit"
            label="Unit"
            onChange={(event) => setUnitId(event.currentTarget.value)}
            options={unitOptions(units)}
            placeholder="Choose a unit"
            required
            value={unitId}
          />
          <AmountInput
            error={fieldError(record.result, 'amountRupees')}
            id="billing-record-amount"
            label="Amount received"
            onChange={(event) => setAmount(event.currentTarget.value)}
            required
            value={amount}
          />
          <SelectInput
            id="billing-record-mode"
            label="Payment mode"
            onChange={(event) => setMode(event.currentTarget.value)}
            options={MODE_OPTIONS}
            value={mode}
          />
          {mode !== 'cash' ? (
            <TextInput
              error={fieldError(record.result, 'reference')}
              helpText="Cheque number, bank or UPI reference (6 to 30 letters or numbers)."
              id="billing-record-reference"
              label="Reference"
              maxLength={30}
              onChange={(event) =>
                setReference(event.currentTarget.value.toUpperCase())
              }
              required
              value={reference}
            />
          ) : null}
          <DatePicker
            error={fieldError(record.result, 'paidOn')}
            id="billing-record-date"
            label="Paid on"
            max={today}
            onChange={setPaidOn}
            required
            value={paidOn}
          />
          {record.result && !record.result.ok ? (
            <ActionResult result={record.result} />
          ) : null}
          <div className="flex justify-end gap-space-3">
            <Button
              disabled={record.pending}
              onClick={() => setOpen(false)}
              variant="secondary"
            >
              Close
            </Button>
            <Button loading={record.pending} type="submit">
              Record Payment
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function AddFineForm({
  today,
  units,
}: {
  today: string;
  units: readonly UnitOption[];
}) {
  const fine = useBillingAction(addBillingFineAction);
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [fineDate, setFineDate] = useState(today);

  return (
    <form
      className="grid max-w-content-narrow gap-space-4"
      onSubmit={(event) => {
        event.preventDefault();
        fine.run({ unitId, amountRupees: amount, reason, fineDate }, () => {
          setUnitId('');
          setAmount('');
          setReason('');
          setFineDate(today);
        });
      }}
    >
      <SelectInput
        error={fieldError(fine.result, 'unitId', 'unit_id')}
        id="billing-fine-unit"
        label="Unit"
        onChange={(event) => setUnitId(event.currentTarget.value)}
        options={unitOptions(units)}
        placeholder="Choose a unit"
        required
        value={unitId}
      />
      <AmountInput
        error={fieldError(fine.result, 'amountRupees', 'amount_paise')}
        id="billing-fine-amount"
        label="Fine amount"
        onChange={(event) => setAmount(event.currentTarget.value)}
        required
        value={amount}
      />
      <TextInput
        error={fieldError(fine.result, 'reason')}
        helpText="Shown to residents on the bill."
        id="billing-fine-reason"
        label="Reason"
        maxLength={160}
        onChange={(event) => setReason(event.currentTarget.value)}
        required
        value={reason}
      />
      <DatePicker
        error={fieldError(fine.result, 'fineDate', 'fine_date')}
        id="billing-fine-date"
        label="Fine date"
        max={today}
        onChange={setFineDate}
        required
        value={fineDate}
      />
      <ActionResult result={fine.result} />
      <div>
        <Button loading={fine.pending} type="submit">
          Add Fine
        </Button>
      </div>
    </form>
  );
}

const REPORT_LABELS: Record<BillingReport, string> = {
  dues_by_unit: 'Dues by unit',
  collections: 'Collections',
  defaulters: 'Defaulters',
};

export function ReportExportButtons({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const exporter = useBillingAction(exportBillingReportAction);
  const [running, setRunning] = useState<BillingReport | null>(null);
  const data = exporter.result?.ok ? exporter.result.data : undefined;

  return (
    <div className="grid gap-space-3">
      <div className="flex flex-wrap gap-space-3">
        {(Object.keys(REPORT_LABELS) as BillingReport[]).map((report) => (
          <Button
            disabled={exporter.pending && running !== report}
            key={report}
            loading={exporter.pending && running === report}
            onClick={() => {
              setRunning(report);
              exporter.run({ report, from, to });
            }}
            variant="secondary"
          >
            Export {REPORT_LABELS[report]} CSV
          </Button>
        ))}
      </div>
      <ActionResult result={exporter.result} />
      {data ? (
        <a
          className={textLinkClass}
          download
          href={`/api/exports/${data.job_id}`}
        >
          Download {REPORT_LABELS[data.report]} CSV ({data.row_count} row
          {data.row_count === 1 ? '' : 's'})
        </a>
      ) : null}
    </div>
  );
}
