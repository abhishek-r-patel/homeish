// Admin and committee screens for informational billing trackers and reports.
'use client';

import { useState, type FormEvent } from 'react';
import {
  cancelBillingPaymentPlanAction,
  saveBillingPaymentPlanAction,
  saveBillingRecoveryActionAction,
} from '@/app/(admin)/admin/billing/actions';
import { Button } from '@/components/ui/button';
import { Card, StatTile } from '@/components/ui/data-display';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { SelectInput, type SelectOption } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import { billingDate, billingMoney } from '@/components/billing/presentation';
import type {
  BillingCollectionEfficiency,
  BillingPaymentPlan,
  BillingPaymentPlanBillOption,
  BillingRecoveryAction,
  BillingRecoveryAdmin,
} from '@/core/billing/validation';
import { rupeesFromPaise } from '@/lib/money';
import { ActionResult, useBillingAction } from './action-state';

const ACTION_TYPES = [
  ['phone_call', 'Phone call'],
  ['in_person_discussion', 'In-person discussion'],
  ['meeting', 'Meeting'],
  ['other_internal', 'Other internal action'],
] as const;

const ACTION_OUTCOMES = [
  ['reached', 'Reached'],
  ['no_response', 'No response'],
  ['follow_up_needed', 'Follow-up needed'],
  ['resolved', 'Resolved'],
  ['other', 'Other'],
] as const;

type UnitOption = { id: string; number: string };

function paymentPlanInput(
  plan: BillingPaymentPlan,
  fields: {
    downPaymentRupees: string;
    installmentCount: string;
    firstDueDate: string;
    remarks: string;
  },
) {
  return {
    id: plan.id,
    billIds: plan.bills.map((bill) => bill.bill_id),
    ...fields,
  };
}

function PaymentPlanRow({
  canManage,
  plan,
}: {
  canManage: boolean;
  plan: BillingPaymentPlan;
}) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const save = useBillingAction(saveBillingPaymentPlanAction);
  const cancel = useBillingAction(cancelBillingPaymentPlanAction);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [downPaymentRupees, setDownPaymentRupees] = useState(
    rupeesFromPaise(plan.down_payment_paise),
  );
  const [installmentCount, setInstallmentCount] = useState(
    String(plan.installment_count),
  );
  const [firstDueDate, setFirstDueDate] = useState(plan.first_due_date);
  const [remarks, setRemarks] = useState(plan.remarks ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.run({
      id: plan.id,
      input: JSON.stringify(
        paymentPlanInput(plan, {
          downPaymentRupees,
          installmentCount,
          firstDueDate,
          remarks,
        }),
      ),
    });
  }

  return (
    <Card
      description={t('Plan date: {date}', {
        date: billingDate(plan.plan_date, locale),
      })}
      title={`${plan.unit_number} · ${t('Payment plan')}`}
    >
      <div className="grid gap-space-4">
        <p className="text-body">
          {t('Plan balance snapshot: {amount}', {
            amount: billingMoney(plan.total_paise, locale),
          })}
        </p>
        <p className="text-body">
          {t('Confirmed payments since plan date: {amount}', {
            amount: billingMoney(plan.progress_paise, locale),
          })}
        </p>
        <p className="text-body text-ink-muted">
          {t('Down payment: {amount} · confirmed: {paid}', {
            amount: billingMoney(plan.down_payment_paise, locale),
            paid: billingMoney(plan.down_payment_paid_paise, locale),
          })}
        </p>
        <p className="text-body text-ink-muted">
          {t('Monthly installment: {amount} · final: {finalAmount}', {
            amount: billingMoney(plan.installment_paise, locale),
            finalAmount: billingMoney(plan.final_installment_paise, locale),
          })}
        </p>
        <p className="text-body text-ink-muted">
          {t('Confirmed toward installments: {amount}', {
            amount: billingMoney(plan.installments_paid_paise, locale),
          })}
        </p>
        <ul className="grid gap-space-2">
          {plan.bills.map((bill) => (
            <li
              className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2 text-body"
              key={bill.bill_id}
            >
              <span>
                {bill.title} · {billingDate(bill.due_date, locale)}
              </span>
              <span className="tabular-nums">
                {billingMoney(bill.snapshot_remaining_paise, locale)}
              </span>
            </li>
          ))}
        </ul>
        {plan.status === 'cancelled' ? (
          <div className="grid gap-space-1">
            <p className="text-body-strong">{t('Cancelled')}</p>
            <p className="text-body text-ink-muted">
              {t('Cancellation reason: {reason}', {
                reason: plan.cancel_reason ?? '',
              })}
            </p>
          </div>
        ) : null}
        {canManage && plan.status === 'active' ? (
          <>
            <form className="grid gap-space-4" onSubmit={submit}>
              <AmountInput
                id={`plan-${plan.id}-down-payment`}
                label={t('Down payment')}
                onChange={(event) =>
                  setDownPaymentRupees(event.currentTarget.value)
                }
                required
                value={downPaymentRupees}
              />
              <TextInput
                id={`plan-${plan.id}-installments`}
                label={t('Number of installments')}
                min={1}
                onChange={(event) =>
                  setInstallmentCount(event.currentTarget.value)
                }
                required
                type="number"
                value={installmentCount}
              />
              <DatePicker
                id={`plan-${plan.id}-first-due`}
                label={t('First installment date')}
                min={plan.plan_date}
                onChange={setFirstDueDate}
                required
                value={firstDueDate}
              />
              <TextAreaInput
                id={`plan-${plan.id}-remarks`}
                label={t('Remarks (optional)')}
                maxLength={500}
                onChange={(event) => setRemarks(event.currentTarget.value)}
                value={remarks}
              />
              <ActionResult result={save.result} />
              <Button loading={save.pending} type="submit">
                {t('Save payment-plan terms')}
              </Button>
            </form>
            <Button
              onClick={() => {
                cancel.reset();
                setCancelOpen(true);
              }}
              variant="destructive"
            >
              {t('Cancel payment plan')}
            </Button>
            <ConfirmDialog
              actionLabel={t('Cancel payment plan')}
              description={t(
                'This keeps the plan history and releases its bills for a replacement plan.',
              )}
              error={
                cancel.result && !cancel.result.ok
                  ? translateFeedback(cancel.result.message)
                  : undefined
              }
              id={`plan-${plan.id}-cancel`}
              loading={cancel.pending}
              onConfirm={(reason) =>
                cancel.run(
                  {
                    id: plan.id,
                    input: JSON.stringify({
                      planId: plan.id,
                      reason: reason ?? '',
                    }),
                  },
                  () => setCancelOpen(false),
                )
              }
              onOpenChange={setCancelOpen}
              open={cancelOpen}
              requiresReason
              title={t('Cancel payment plan')}
            />
            {cancel.result?.ok ? <ActionResult result={cancel.result} /> : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

function PaymentPlanCreateForm({
  bills,
  today,
}: {
  bills: BillingPaymentPlanBillOption[];
  today: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const save = useBillingAction(saveBillingPaymentPlanAction);
  const units = Array.from(
    new Map(
      bills.map((bill) => [
        bill.unit_id,
        { id: bill.unit_id, number: bill.unit_number },
      ]),
    ).values(),
  );
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [downPaymentRupees, setDownPaymentRupees] = useState('0');
  const [installmentCount, setInstallmentCount] = useState('12');
  const [firstDueDate, setFirstDueDate] = useState(today);
  const [remarks, setRemarks] = useState('');
  const currentUnitId = units.some((unit) => unit.id === unitId)
    ? unitId
    : (units[0]?.id ?? '');
  const unitBills = bills.filter((bill) => bill.unit_id === currentUnitId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.run(
      {
        id: '',
        input: JSON.stringify({
          id: null,
          billIds: selectedBillIds,
          downPaymentRupees,
          installmentCount,
          firstDueDate,
          remarks,
        }),
      },
      () => {
        setSelectedBillIds([]);
        setRemarks('');
      },
    );
  }

  if (bills.length === 0) {
    return (
      <Card title={t('Create payment plan')}>
        <p className="text-body text-ink-muted">
          {t('There are no open bills available to add to a new plan.')}
        </p>
      </Card>
    );
  }

  const unitOptions: SelectOption[] = units.map((unit) => ({
    value: unit.id,
    label: unit.number,
  }));

  return (
    <Card
      description={t(
        'Plans track selected open bills and do not change the ledger.',
      )}
      title={t('Create payment plan')}
    >
      <form className="grid gap-space-4" onSubmit={submit}>
        <SelectInput
          id="plan-unit"
          label={t('Unit')}
          onChange={(event) => {
            setUnitId(event.currentTarget.value);
            setSelectedBillIds([]);
          }}
          options={unitOptions}
          required
          value={currentUnitId}
        />
        <fieldset className="grid gap-space-2">
          <legend className="text-body-strong">{t('Open bills')}</legend>
          <p className="text-caption text-ink-muted">
            {t('Select one or more bills from this unit.')}
          </p>
          {unitBills.map((bill) => (
            <label
              className="flex min-h-12 items-center gap-space-3 border-b border-rule py-space-2 text-body"
              key={bill.id}
            >
              <input
                checked={selectedBillIds.includes(bill.id)}
                className="size-5 accent-brand"
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelectedBillIds((current) =>
                    checked
                      ? [...current, bill.id]
                      : current.filter((id) => id !== bill.id),
                  );
                }}
                type="checkbox"
              />
              <span className="flex-1">
                {bill.title} · {billingDate(bill.due_date, locale)}
              </span>
              <span className="tabular-nums">
                {billingMoney(bill.outstanding_paise, locale)}
              </span>
            </label>
          ))}
        </fieldset>
        <AmountInput
          id="plan-create-down-payment"
          label={t('Down payment')}
          onChange={(event) => setDownPaymentRupees(event.currentTarget.value)}
          required
          value={downPaymentRupees}
        />
        <TextInput
          id="plan-create-installments"
          label={t('Number of installments')}
          min={1}
          onChange={(event) => setInstallmentCount(event.currentTarget.value)}
          required
          type="number"
          value={installmentCount}
        />
        <DatePicker
          id="plan-create-first-due"
          label={t('First installment date')}
          min={today}
          onChange={setFirstDueDate}
          required
          value={firstDueDate}
        />
        <TextAreaInput
          id="plan-create-remarks"
          label={t('Remarks (optional)')}
          maxLength={500}
          onChange={(event) => setRemarks(event.currentTarget.value)}
          value={remarks}
        />
        <ActionResult result={save.result} />
        <Button
          disabled={selectedBillIds.length === 0}
          loading={save.pending}
          type="submit"
        >
          {t('Create payment plan')}
        </Button>
      </form>
    </Card>
  );
}

export function PaymentPlansPanel({
  bills,
  canManage,
  plans,
  today,
}: {
  bills: BillingPaymentPlanBillOption[];
  canManage: boolean;
  plans: BillingPaymentPlan[];
  today: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-5">
      {canManage ? <PaymentPlanCreateForm bills={bills} today={today} /> : null}
      <Card
        description={t(
          'Progress counts confirmed payments dated on or after the plan date. Current ledger due remains authoritative.',
        )}
        title={t('Payment plans')}
      >
        {plans.length ? (
          <div className="grid gap-space-4">
            {plans.map((plan) => (
              <PaymentPlanRow canManage={canManage} key={plan.id} plan={plan} />
            ))}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No payment plans have been created.')}
          </p>
        )}
      </Card>
    </div>
  );
}

function RecoveryActionForm({
  action,
  admins,
  today,
  units,
}: {
  action?: BillingRecoveryAction;
  admins: BillingRecoveryAdmin[];
  today: string;
  units: UnitOption[];
}) {
  const { translate: t } = useUiTranslator();
  const save = useBillingAction(saveBillingRecoveryActionAction);
  const [unitId, setUnitId] = useState(action?.unit_id ?? units[0]?.id ?? '');
  const [actionDate, setActionDate] = useState(action?.action_date ?? today);
  const [actionType, setActionType] = useState(
    action?.action_type ?? 'phone_call',
  );
  const [outcome, setOutcome] = useState(action?.outcome ?? 'follow_up_needed');
  const [nextActionDate, setNextActionDate] = useState(
    action?.next_action_date ?? today,
  );
  const [assignee, setAssignee] = useState(
    action?.assigned_admin_user_id ?? '',
  );
  const [status, setStatus] = useState(action?.status ?? 'open');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.run({
      id: action?.id ?? '',
      input: JSON.stringify({
        id: action?.id ?? null,
        unitId,
        actionDate,
        actionType,
        outcome,
        nextActionDate,
        assignedAdminUserId: assignee || null,
        status,
      }),
    });
  }

  const actionTypeOptions: SelectOption[] = ACTION_TYPES.map(
    ([value, label]) => ({
      value,
      label: t(label),
    }),
  );
  const outcomeOptions: SelectOption[] = ACTION_OUTCOMES.map(
    ([value, label]) => ({ value, label: t(label) }),
  );
  const unitOptions: SelectOption[] = units.map((unit) => ({
    value: unit.id,
    label: unit.number,
  }));
  const adminOptions: SelectOption[] = admins.map((admin) => ({
    value: admin.id,
    label: admin.name,
  }));
  if (
    action?.assigned_admin_user_id &&
    !admins.some((admin) => admin.id === action.assigned_admin_user_id)
  ) {
    adminOptions.push({
      value: action.assigned_admin_user_id,
      label: `${action.assigned_admin_name ?? t('Inactive administrator')} · ${t('inactive')}`,
      disabled: true,
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <SelectInput
        id={`recovery-${action?.id ?? 'new'}-unit`}
        label={t('Unit')}
        onChange={(event) => setUnitId(event.currentTarget.value)}
        options={unitOptions}
        required
        value={unitId}
      />
      <SelectInput
        id={`recovery-${action?.id ?? 'new'}-type`}
        label={t('Action type')}
        onChange={(event) => {
          const value = ACTION_TYPES.find(
            ([option]) => option === event.currentTarget.value,
          )?.[0];
          if (value) setActionType(value);
        }}
        options={actionTypeOptions}
        required
        value={actionType}
      />
      <SelectInput
        id={`recovery-${action?.id ?? 'new'}-outcome`}
        label={t('Outcome')}
        onChange={(event) => {
          const value = ACTION_OUTCOMES.find(
            ([option]) => option === event.currentTarget.value,
          )?.[0];
          if (value) setOutcome(value);
        }}
        options={outcomeOptions}
        required
        value={outcome}
      />
      <DatePicker
        id={`recovery-${action?.id ?? 'new'}-action-date`}
        label={t('Action date')}
        onChange={setActionDate}
        required
        value={actionDate}
      />
      <DatePicker
        id={`recovery-${action?.id ?? 'new'}-next-action`}
        label={t('Next action date')}
        onChange={setNextActionDate}
        required
        value={nextActionDate}
      />
      <SelectInput
        id={`recovery-${action?.id ?? 'new'}-assignee`}
        label={t('Assigned administrator (optional)')}
        onChange={(event) => setAssignee(event.currentTarget.value)}
        options={adminOptions}
        placeholder={t('No assignee')}
        value={assignee}
      />
      <SelectInput
        id={`recovery-${action?.id ?? 'new'}-status`}
        label={t('Follow-up status')}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === 'open' || value === 'closed') setStatus(value);
        }}
        options={[
          { value: 'open', label: t('Open') },
          { value: 'closed', label: t('Closed') },
        ]}
        required
        value={status}
      />
      <ActionResult result={save.result} />
      <Button loading={save.pending} type="submit">
        {action ? t('Save recovery-action changes') : t('Save recovery action')}
      </Button>
    </form>
  );
}

function RecoveryActionRow({
  action,
  admins,
  canManage,
  today,
  units,
}: {
  action: BillingRecoveryAction;
  admins: BillingRecoveryAdmin[];
  canManage: boolean;
  today: string;
  units: UnitOption[];
}) {
  const { locale, translate: t } = useUiTranslator();
  const followUpLabel: Record<
    BillingRecoveryAction['follow_up_state'],
    string
  > = {
    closed: 'Closed',
    overdue: 'Overdue',
    due_soon: 'Due Soon',
    scheduled: 'Scheduled',
  };
  const actionLabel =
    ACTION_TYPES.find(([value]) => value === action.action_type)?.[1] ??
    'Other internal action';
  const outcomeLabel =
    ACTION_OUTCOMES.find(([value]) => value === action.outcome)?.[1] ?? 'Other';
  return (
    <Card
      description={t('{type} · {outcome}', {
        type: t(actionLabel),
        outcome: t(outcomeLabel),
      })}
      title={`${action.unit_number} · ${billingDate(action.action_date, locale)}`}
    >
      <div className="grid gap-space-3">
        <p className="text-body">
          {t('Next action: {date} · {status}', {
            date: billingDate(action.next_action_date, locale),
            status: t(followUpLabel[action.follow_up_state]),
          })}
        </p>
        {action.assigned_admin_name ? (
          <p className="text-body text-ink-muted">
            {t('Assigned to: {name}', { name: action.assigned_admin_name })}
          </p>
        ) : null}
        {canManage ? (
          <details className="border-t border-rule pt-space-3">
            <summary className="min-h-12 cursor-pointer py-space-3 text-body-strong">
              {t('Edit recovery action')}
            </summary>
            <RecoveryActionForm
              action={action}
              admins={admins}
              today={today}
              units={units}
            />
          </details>
        ) : null}
      </div>
    </Card>
  );
}

export function RecoveryActionsPanel({
  actions,
  admins,
  canManage,
  today,
  units,
}: {
  actions: BillingRecoveryAction[];
  admins: BillingRecoveryAdmin[];
  canManage: boolean;
  today: string;
  units: UnitOption[];
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-5">
      {canManage ? (
        <Card
          description={t(
            'These internal records do not send messages or represent legal service.',
          )}
          title={t('Record recovery action')}
        >
          {units.length ? (
            <RecoveryActionForm admins={admins} today={today} units={units} />
          ) : (
            <p className="text-body text-ink-muted">
              {t('There are no active units available.')}
            </p>
          )}
        </Card>
      ) : null}
      <Card title={t('Recovery follow-ups')}>
        {actions.length ? (
          <div className="grid gap-space-4">
            {actions.map((action) => (
              <RecoveryActionRow
                action={action}
                admins={admins}
                canManage={canManage}
                key={action.id}
                today={today}
                units={units}
              />
            ))}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No recovery actions have been recorded.')}
          </p>
        )}
      </Card>
      <p className="text-caption text-ink-muted">
        {t('Today: {date}', { date: billingDate(today, locale) })}
      </p>
    </div>
  );
}

export function CollectionEfficiencyPanel({
  report,
}: {
  report: BillingCollectionEfficiency;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-5">
      <Card
        description={t(
          'Confirmed payments allocated to bills due by this date; advance credit is excluded.',
        )}
        title={t('As-of date: {date}', {
          date: billingDate(report.as_of_date, locale),
        })}
      >
        <form
          action="/admin/billing"
          className="flex flex-wrap items-end gap-space-3"
          method="get"
        >
          <input name="tab" type="hidden" value="collection-efficiency" />
          <label className="grid gap-space-1 text-body-strong">
            {t('As-of date')}
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body font-normal"
              defaultValue={report.as_of_date}
              name="asOfDate"
              required
              type="date"
            />
          </label>
          <Button type="submit" variant="secondary">
            {t('Update')}
          </Button>
        </form>
      </Card>
      <div className="grid gap-space-3 medium:grid-cols-2">
        <StatTile
          context={t('Confirmed allocations to bills due by the as-of date')}
          label={t('Collected')}
          value={billingMoney(report.collected_paise, locale)}
        />
        <StatTile
          context={t('Original bill amounts less approved waivers')}
          label={t('Billed after waivers')}
          value={billingMoney(report.billed_paise, locale)}
        />
        <StatTile
          context={
            report.collection_percent === null
              ? t('No bills were due by this date')
              : t('{percent}% collected', {
                  percent: new Intl.NumberFormat(
                    locale === 'hi' ? 'hi-IN' : 'en-IN',
                    { maximumFractionDigits: 1 },
                  ).format(report.collection_percent),
                })
          }
          label={t('Collection efficiency')}
          value={
            report.collection_percent === null
              ? t('Not available')
              : `${new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
                  maximumFractionDigits: 1,
                }).format(report.collection_percent)}%`
          }
        />
      </div>
      <p className="text-caption text-ink-muted">
        {t(
          'This report is read-only and separate from the existing collection and defaulter reports.',
        )}
      </p>
    </div>
  );
}
