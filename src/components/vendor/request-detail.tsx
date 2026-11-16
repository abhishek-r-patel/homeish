// Show one purchase request with its quotes, quote rule, approvals and lifecycle actions.
'use client';
import { useId, useState } from 'react';
import {
  VENDOR_EXPENSE_DRAFT_LABELS,
  VENDOR_REQUEST_STATUS_LABELS,
  approvalsText,
  formatPaise,
  quoteRuleBasisText,
  quoteRuleText,
} from '@/core/vendor/presentation';
import {
  vendorQuoteInputSchema,
  vendorQuoteOverrideInputSchema,
  vendorRequestCancelInputSchema,
  vendorRequestRejectInputSchema,
  type VendorRequestDetail,
} from '@/core/vendor/validation';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import {
  VENDOR_ACTIONS,
  VENDOR_BASE_HREF,
  VendorFileLink,
  VendorFilePicker,
  VendorQuickAction,
  type VendorActions,
} from './shared';
import { PurchaseRequestForm, readRupees } from './workspace';

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});
const formatTime = (value: string) => timeFormat.format(new Date(value));

function QuoteForm({
  detail,
  actions,
}: {
  detail: VendorRequestDetail;
  actions: VendorActions;
}) {
  const id = useId();
  const [path, setPath] = useState<string | null>(null);
  const quoted = new Set(detail.quotes.map((quote) => quote.vendor_id));
  const vendors = detail.vendors.filter((vendor) => !quoted.has(vendor.id));
  if (vendors.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        Every active vendor has quoted. An admin can add vendors from the
        Vendors list.
      </p>
    );
  }
  return (
    <ModuleActionForm
      action={actions.addQuote}
      idempotent
      submitLabel="Add quote"
      input={(form, clientRequestId) =>
        vendorQuoteInputSchema.parse({
          purchaseRequestId: detail.request.id,
          vendorId: form.get('vendorId'),
          amountPaise: readRupees(form, 'amount', 'amountPaise'),
          note: String(form.get('note') ?? ''),
          filePath: path,
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-vendor`}
        name="vendorId"
        label="Vendor"
        required
        options={vendors.map((vendor) => ({
          value: vendor.id,
          label: vendor.name,
        }))}
      />
      <AmountInput
        id={`${id}-amount`}
        name="amount"
        label="Quoted amount"
        required
      />
      <TextAreaInput
        id={`${id}-note`}
        name="note"
        label="Note (optional)"
        maxLength={500}
      />
      <VendorFilePicker
        label="Quote file (optional)"
        prepareUpload={actions.prepareQuoteUpload}
        request={actions.uploadRequest}
        onChange={setPath}
      />
    </ModuleActionForm>
  );
}

function OverrideForm({
  detail,
  actions,
}: {
  detail: VendorRequestDetail;
  actions: VendorActions;
}) {
  const id = useId();
  const request = detail.request;
  if (request.quote_override_reason) {
    return (
      <VendorQuickAction
        action={actions.overrideRule}
        input={{
          purchaseRequestId: request.id,
          reason: null,
          expectedVersion: request.version,
        }}
        label="Remove the override"
      />
    );
  }
  return (
    <ModuleActionForm
      action={actions.overrideRule}
      submitLabel="Override the quote rule"
      confirmMessage="Override the quote rule for this request? Your reason is recorded in the audit log."
      input={(form) =>
        vendorQuoteOverrideInputSchema.parse({
          purchaseRequestId: request.id,
          reason: String(form.get('reason') ?? ''),
          expectedVersion: request.version,
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label="Reason for overriding (required)"
        helpText="For example: only one supplier stocks this part."
        required
        minLength={5}
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

function ReasonForm({
  label,
  submitLabel,
  confirmMessage,
  required,
  action,
  parse,
}: {
  label: string;
  submitLabel: string;
  confirmMessage: string;
  required: boolean;
  action: VendorActions['reject'];
  parse: (reason: string) => unknown;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={submitLabel}
      confirmMessage={confirmMessage}
      input={(form) => parse(String(form.get('reason') ?? ''))}
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={label}
        required={required}
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

function Lifecycle({ detail }: { detail: VendorRequestDetail }) {
  const request = detail.request;
  const rows: [string, string][] = [
    [
      'Raised',
      `${formatTime(request.created_at)}${request.created_by_name ? ` by ${request.created_by_name}` : ''}`,
    ],
  ];
  if (request.submitted_at) {
    rows.push(['Submitted', formatTime(request.submitted_at)]);
  }
  if (request.decided_at) {
    rows.push([
      request.status === 'rejected' ? 'Rejected' : 'Approved',
      `${formatTime(request.decided_at)}${request.decided_by_name ? ` by ${request.decided_by_name}` : ''}`,
    ]);
  }
  if (request.rejection_reason) {
    rows.push(['Reason for rejection', request.rejection_reason]);
  }
  if (request.cancelled_at) {
    rows.push([
      'Cancelled',
      `${formatTime(request.cancelled_at)}${request.cancelled_by_name ? ` by ${request.cancelled_by_name}` : ''}${request.cancel_reason ? `: ${request.cancel_reason}` : ''}`,
    ]);
  }
  return (
    <dl className="grid gap-space-2 text-body">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-space-1">
          <dt className="text-caption text-ink-muted">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PurchaseRequestView({
  detail,
  actions = VENDOR_ACTIONS,
}: {
  detail: VendorRequestDetail;
  actions?: VendorActions;
}) {
  const request = detail.request;
  const rule = detail.rule;
  const draft = request.status === 'draft';
  const selected = detail.quotes.find((quote) => quote.selected) ?? null;
  const canSubmit = detail.can_edit && rule.met && selected !== null;
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <a
          href={VENDOR_BASE_HREF}
          className="inline-flex min-h-12 w-fit items-center text-brand underline"
        >
          Back to vendors and purchases
        </a>
        <h1 className="text-title font-semibold">{request.title}</h1>
        <p className="text-body text-ink-muted">
          {VENDOR_REQUEST_STATUS_LABELS[request.status]} · Estimated{' '}
          {formatPaise(request.estimated_amount_paise)}
          {request.category ? ` · ${request.category}` : ''}
        </p>
        {request.description ? (
          <p className="whitespace-pre-line text-body">{request.description}</p>
        ) : null}
      </header>

      <Card title="Quote rule" description={quoteRuleBasisText(rule)}>
        <div className="grid gap-space-3">
          <p className="text-body-strong">{quoteRuleText(rule)}</p>
          {request.quote_override_reason ? (
            <Banner tone="warning" title="Quote rule overridden">
              {request.quote_override_reason}
              {request.quote_override_by_name
                ? ` (${request.quote_override_by_name})`
                : ''}
            </Banner>
          ) : null}
          {detail.can_override ? (
            <OverrideForm detail={detail} actions={actions} />
          ) : null}
        </div>
      </Card>

      <Card
        title="Quotes"
        description={
          draft
            ? 'Quotes can change only while the request is a draft. Each vendor quotes once.'
            : 'Quotes are locked after submission. Cancel and raise a new request to change them.'
        }
      >
        <div className="grid gap-space-4">
          {detail.quotes.length > 0 ? (
            <ul className="grid gap-space-3">
              {detail.quotes.map((quote) => (
                <li
                  key={quote.id}
                  className="grid gap-space-2 rounded-md border border-rule p-space-3"
                >
                  <p className="text-body-strong">
                    {quote.vendor_name} · {formatPaise(quote.amount_paise)}
                    {quote.selected ? ' · Selected' : ''}
                  </p>
                  {quote.note ? (
                    <p className="text-body">{quote.note}</p>
                  ) : null}
                  {quote.file_path ? (
                    <VendorFileLink
                      path={quote.file_path}
                      label={`quote from ${quote.vendor_name}`}
                      fileLink={actions.fileLink}
                    />
                  ) : null}
                  {detail.can_edit ? (
                    <div className="flex flex-wrap gap-space-3">
                      {quote.selected ? null : (
                        <VendorQuickAction
                          action={actions.selectQuote}
                          input={{
                            purchaseRequestId: request.id,
                            quoteId: quote.id,
                            expectedVersion: request.version,
                          }}
                          label={`Select ${quote.vendor_name}`}
                        />
                      )}
                      <VendorQuickAction
                        action={actions.removeQuote}
                        input={{ quoteId: quote.id }}
                        label={`Remove quote from ${quote.vendor_name}`}
                        confirmMessage="Remove this quote?"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-muted">No quotes yet.</p>
          )}
          {detail.can_edit ? (
            <QuoteForm detail={detail} actions={actions} />
          ) : null}
        </div>
      </Card>

      <Card
        title="Approvals"
        description={
          request.status === 'draft'
            ? `${approvalsText(0, detail.approvals_required)} needed after submission. The person who raised a request cannot approve it.`
            : approvalsText(detail.approvals.length, detail.approvals_required)
        }
      >
        <div className="grid gap-space-3">
          {detail.approvals.length > 0 ? (
            <ul className="grid gap-space-2">
              {detail.approvals.map((approval) => (
                <li key={approval.created_at} className="text-body">
                  {approval.approver_name ?? 'A member'} (
                  {approval.approver_role}) · {formatTime(approval.created_at)}
                </li>
              ))}
            </ul>
          ) : null}
          {detail.approved_by_me ? (
            <p className="text-body text-ink-muted">You have approved this.</p>
          ) : null}
          {detail.approval_blocked_reason ? (
            <p className="text-body text-ink-muted">
              {detail.approval_blocked_reason}
            </p>
          ) : null}
          {detail.can_approve ? (
            <VendorQuickAction
              action={actions.approve}
              input={{ purchaseRequestId: request.id }}
              label="Approve"
              confirmMessage={`Approve this purchase of ${formatPaise(rule.basis_amount_paise)}?`}
            />
          ) : null}
          {detail.can_reject ? (
            <ReasonForm
              label="Reason for rejecting (required)"
              submitLabel="Reject"
              confirmMessage="Reject this request? The requester is notified with your reason."
              required
              action={actions.reject}
              parse={(reason) =>
                vendorRequestRejectInputSchema.parse({
                  purchaseRequestId: request.id,
                  reason,
                })
              }
            />
          ) : null}
        </div>
      </Card>

      {request.status === 'approved' ? (
        <Card title="Expense draft">
          <div className="grid gap-space-3">
            <p className="text-body">
              {request.expense_draft_status
                ? VENDOR_EXPENSE_DRAFT_LABELS[request.expense_draft_status]
                : 'No expense draft was requested.'}
              {request.expense_status === 'posted'
                ? ' The expense has been posted.'
                : request.expense_status === 'rejected'
                  ? ' The expense was rejected in Expenses.'
                  : ''}
            </p>
            {detail.can_retry_expense ? (
              <VendorQuickAction
                action={actions.retryExpense}
                input={{ purchaseRequestId: request.id }}
                label="Retry the expense draft"
              />
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card title="History">
        <Lifecycle detail={detail} />
      </Card>

      {detail.can_edit ? (
        <>
          <Card
            title="Submit for approval"
            description={
              canSubmit
                ? 'Approvers are notified. Quotes are locked after this.'
                : 'Select a quote and collect the quotes the rule needs first.'
            }
          >
            {canSubmit ? (
              <VendorQuickAction
                action={actions.submit}
                input={{
                  purchaseRequestId: request.id,
                  expectedVersion: request.version,
                }}
                label="Submit for approval"
                confirmMessage="Submit this request? Quotes cannot change afterwards."
              />
            ) : null}
          </Card>
          <Card title="Edit draft">
            <PurchaseRequestForm request={request} actions={actions} />
          </Card>
        </>
      ) : null}

      {detail.can_cancel ? (
        <Card title="Cancel request">
          <ReasonForm
            label="Reason (optional)"
            submitLabel="Cancel request"
            confirmMessage="Cancel this request? It cannot be reopened."
            required={false}
            action={actions.cancel}
            parse={(reason) =>
              vendorRequestCancelInputSchema.parse({
                purchaseRequestId: request.id,
                reason,
              })
            }
          />
        </Card>
      ) : null}
    </section>
  );
}
