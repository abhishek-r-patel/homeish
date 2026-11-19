// Show the P47 vendor registers: summary, contracts, agency checks, work orders and bills owed.
'use client';
import { useId, useState, type ReactNode } from 'react';
import { ValidationError } from '@/core/errors';
import { formatLocalizedDate } from '@/core/i18n/format';
import { paiseToRupeesInput, rupeesToPaise } from '@/core/vendor/presentation';
import {
  VENDOR_PAYMENT_FREQUENCIES,
  vendorBillCancelInputSchema,
  vendorBillInputSchema,
  vendorBillPaymentLinkInputSchema,
  vendorBillPaymentUnlinkInputSchema,
  vendorContractInputSchema,
  vendorContractRenewInputSchema,
  vendorContractTerminateInputSchema,
  vendorStaffDayCheckInputSchema,
  vendorWorkOrderCreateInputSchema,
  vendorWorkOrderStatusInputSchema,
  vendorWorkOrderUpdateInputSchema,
  type VendorBill,
  type VendorBills,
  type VendorContract,
  type VendorContracts,
  type VendorStaffDayCheck,
  type VendorStaffDayChecks,
  type VendorSummary,
  type VendorWorkOrder,
  type VendorWorkOrders,
} from '@/core/vendor/validation';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { Card, StatTile, StatusChip } from '@/components/ui/data-display';
import { EmptyState, ErrorPanel } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  VENDOR_BASE_HREF,
  VendorFileLink,
  VendorFilePicker,
  VendorQuickAction,
  type VendorActions,
} from './shared';
import { readRupees } from './workspace';
import { useVendorPresentation } from './presentation';

/** One register read; a failed view shows its own error so the rest of the page still works. */
export type RegisterLoad<T> =
  { ok: true; data: T } | { ok: false; message: string; referenceId?: string };

export type VendorOption = { id: string; name: string };

export const VENDOR_REGISTER_ANCHORS = {
  vendors: 'vendors',
  contracts: 'contracts',
  checks: 'agency-checks',
  workOrders: 'work-orders',
  bills: 'bills',
  ratings: 'ratings',
} as const;

const FREQUENCY_LABELS: Record<
  (typeof VENDOR_PAYMENT_FREQUENCIES)[number],
  string
> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
  one_time: 'One-time',
};

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

function optionalInteger(form: FormData, name: string) {
  const value = text(form, name).trim();
  return value === '' ? null : Number(value);
}

function optionalRupees(form: FormData, name: string, field: string) {
  return text(form, name).trim() === '' ? null : readRupees(form, name, field);
}

function rupeesOrZero(form: FormData, name: string, field: string) {
  const paise = rupeesToPaise(text(form, name));
  if (paise === null || paise < 0) {
    throw new ValidationError({
      [field]: 'Enter an amount in rupees, for example 25000 or 1250.50.',
    });
  }
  return paise;
}

function shiftDate(iso: string, days: number, years = 0) {
  const value = new Date(`${iso}T00:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function useMonth() {
  const { locale } = useVendorPresentation();
  return (value: string) =>
    formatLocalizedDate(new Date(value), locale ?? 'en', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="min-w-0">
      {children}
    </div>
  );
}

function RegisterError({
  title,
  load,
}: {
  title: string;
  load: Extract<RegisterLoad<unknown>, { ok: false }>;
}) {
  const { t, translateFeedback } = useVendorPresentation();
  return (
    <ErrorPanel
      title={title}
      message={translateFeedback(load.message)}
      referenceId={load.referenceId}
      action={
        <a
          href=""
          className="inline-flex min-h-12 w-fit items-center text-brand underline"
        >
          {t('Retry')}
        </a>
      }
    />
  );
}

function MoreForm({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rounded-md border border-rule p-space-3">
      <summary className="min-h-12 cursor-pointer content-center text-body-strong text-brand">
        {label}
      </summary>
      <div className="mt-space-3">{children}</div>
    </details>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      {children}
    </li>
  );
}

export function VendorSummaryStrip({
  load,
  scoped = false,
}: {
  load: RegisterLoad<VendorSummary>;
  scoped?: boolean;
}) {
  const { t, money, number } = useVendorPresentation();
  if (!load.ok)
    return <RegisterError title={t('Vendor summary')} load={load} />;
  const summary = load.data;
  const anchor = (key: keyof typeof VENDOR_REGISTER_ANCHORS) =>
    `#${VENDOR_REGISTER_ANCHORS[key]}`;
  return (
    <section
      aria-label={t('Vendor summary')}
      className="grid grid-cols-1 gap-space-3 medium:grid-cols-3"
    >
      {summary.active_vendors !== null ? (
        <StatTile
          label={t('Active vendors')}
          value={number(summary.active_vendors)}
          href={anchor('vendors')}
        />
      ) : null}
      <StatTile
        label={t('Active contract value')}
        value={money(summary.active_contract_value_paise)}
        context={t('Per year')}
        href={anchor('contracts')}
      />
      <StatTile
        label={t('Renewals due')}
        value={number(summary.renewals_due)}
        context={t('{general} contracts · {amc} AMC', {
          general: number(summary.renewals_due_general),
          amc: number(summary.renewals_due_amc),
        })}
        href={anchor('contracts')}
      />
      <StatTile
        label={t('Average rating')}
        value={
          summary.rating_average === null
            ? '—'
            : t('{average} of 5', { average: summary.rating_average })
        }
        context={t('{count} ratings', { count: number(summary.rating_count) })}
        href={anchor(scoped ? 'ratings' : 'vendors')}
      />
      <StatTile
        label={t('Open work orders')}
        value={number(summary.open_work_orders)}
        href={anchor('workOrders')}
      />
      <StatTile
        label={t('Overdue AMC services')}
        value={number(summary.overdue_amc_services)}
        href="/admin/amc"
      />
      <StatTile
        label={t('Bills owed')}
        value={money(summary.bills_owed_paise)}
        context={t('{count} open bills', {
          count: number(summary.bills_owed_count),
        })}
        href={anchor('bills')}
      />
    </section>
  );
}

function ContractForm({
  mode,
  contract,
  vendors,
  vendorId,
  today,
  actions,
}: {
  mode: 'new' | 'edit' | 'renew';
  contract?: VendorContract;
  vendors?: VendorOption[];
  vendorId?: string;
  today: string;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [removeCurrent, setRemoveCurrent] = useState(false);
  const source = contract;
  const startDefault =
    mode === 'edit' && source
      ? source.start_date
      : mode === 'renew' && source
        ? shiftDate(source.end_date, 1)
        : today;
  const endDefault =
    mode === 'edit' && source
      ? source.end_date
      : mode === 'renew'
        ? shiftDate(startDefault, -1, 1)
        : '';
  const currentDocument =
    mode === 'edit' && source && !removeCurrent ? source.document_path : null;
  const terms = (form: FormData) => ({
    scope: text(form, 'scope'),
    startDate: text(form, 'startDate'),
    endDate: text(form, 'endDate'),
    annualValuePaise: rupeesOrZero(form, 'annualValue', 'annualValuePaise'),
    paymentFrequency: text(form, 'paymentFrequency'),
    autoRenew: form.get('autoRenew') === 'on',
    noticeDays: optionalInteger(form, 'noticeDays'),
    documentPath: uploaded ?? currentDocument,
    defaultSanctionedDays: optionalInteger(form, 'defaultSanctionedDays'),
    deductionPerDayPaise: optionalRupees(
      form,
      'deductionPerDay',
      'deductionPerDayPaise',
    ),
  });
  const pickVendor = mode === 'new' && !vendorId;
  return (
    <ModuleActionForm
      action={mode === 'renew' ? actions.renewContract : actions.saveContract}
      idempotent={mode !== 'edit'}
      submitLabel={t(
        mode === 'renew'
          ? 'Save renewal'
          : mode === 'edit'
            ? 'Save contract'
            : 'Add contract',
      )}
      input={(form, clientRequestId) =>
        mode === 'renew'
          ? vendorContractRenewInputSchema.parse({
              predecessorId: source?.id,
              ...terms(form),
              clientRequestId,
            })
          : vendorContractInputSchema.parse({
              contractId: source && mode === 'edit' ? source.id : null,
              vendorId:
                mode === 'edit'
                  ? (source?.vendor_id ?? null)
                  : (vendorId ?? (text(form, 'vendorId') || null)),
              ...terms(form),
              expectedVersion:
                source && mode === 'edit' ? source.version : null,
              clientRequestId,
            })
      }
    >
      {pickVendor ? (
        <SelectInput
          id={`${id}-vendor`}
          name="vendorId"
          label={t('Vendor')}
          required
          defaultValue=""
          options={[
            { value: '', label: t('Choose a vendor') },
            ...(vendors ?? []).map((vendor) => ({
              value: vendor.id,
              label: vendor.name,
            })),
          ]}
        />
      ) : null}
      <TextAreaInput
        id={`${id}-scope`}
        name="scope"
        label={t('Scope')}
        helpText={t('What the vendor provides, for example Security staff.')}
        required
        maxLength={500}
        defaultValue={source?.scope ?? ''}
      />
      <TextInput
        id={`${id}-start`}
        name="startDate"
        type="date"
        label={t('Start date')}
        required
        defaultValue={startDefault}
      />
      <TextInput
        id={`${id}-end`}
        name="endDate"
        type="date"
        label={t('End date')}
        required
        defaultValue={endDefault}
      />
      <AmountInput
        id={`${id}-value`}
        name="annualValue"
        label={t('Annual value')}
        required
        defaultValue={
          source ? paiseToRupeesInput(source.annual_value_paise) : ''
        }
      />
      <SelectInput
        id={`${id}-frequency`}
        name="paymentFrequency"
        label={t('Payment frequency')}
        required
        defaultValue={source?.payment_frequency ?? 'monthly'}
        options={VENDOR_PAYMENT_FREQUENCIES.map((value) => ({
          value,
          label: t(FREQUENCY_LABELS[value]),
        }))}
      />
      <CheckboxInput
        id={`${id}-auto`}
        name="autoRenew"
        label={t('Auto-renews')}
        defaultChecked={source?.auto_renew ?? false}
      />
      <TextInput
        id={`${id}-notice`}
        name="noticeDays"
        type="number"
        min={0}
        max={365}
        label={t('Notice period in days (optional)')}
        defaultValue={source?.notice_days?.toString() ?? ''}
      />
      <TextInput
        id={`${id}-sanctioned`}
        name="defaultSanctionedDays"
        type="number"
        min={1}
        max={31}
        label={t('Default sanctioned days (optional)')}
        helpText={t('For agency staff checks, for example 26 days a month.')}
        defaultValue={source?.default_sanctioned_days?.toString() ?? ''}
      />
      <AmountInput
        id={`${id}-deduction`}
        name="deductionPerDay"
        label={t('Deduction per missing day (optional)')}
        defaultValue={
          source?.deduction_per_day_paise
            ? paiseToRupeesInput(source.deduction_per_day_paise)
            : ''
        }
      />
      {mode === 'edit' && source?.document_path ? (
        <CheckboxInput
          id={`${id}-remove`}
          label={t('Remove the current contract document')}
          checked={removeCurrent}
          onChange={(event) => setRemoveCurrent(event.currentTarget.checked)}
        />
      ) : null}
      <VendorFilePicker
        label={t(
          mode === 'edit' && source?.document_path
            ? 'Replace contract document (optional)'
            : 'Contract document (optional)',
        )}
        prepareUpload={actions.prepareDocumentUpload}
        request={actions.uploadRequest}
        onChange={setUploaded}
      />
    </ModuleActionForm>
  );
}

function TerminateForm({
  contract,
  today,
  actions,
}: {
  contract: VendorContract;
  today: string;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  const defaultDate =
    today < contract.start_date
      ? contract.start_date
      : today > contract.end_date
        ? contract.end_date
        : today;
  return (
    <ModuleActionForm
      action={actions.terminateContract}
      submitLabel={t('End contract early')}
      confirmMessage={t(
        'End this contract early? It stays in the register with the reason.',
      )}
      input={(form) =>
        vendorContractTerminateInputSchema.parse({
          contractId: contract.id,
          terminatedOn: text(form, 'terminatedOn'),
          reason: text(form, 'reason'),
          expectedVersion: contract.version,
        })
      }
    >
      <TextInput
        id={`${id}-date`}
        name="terminatedOn"
        type="date"
        label={t('End date')}
        min={contract.start_date}
        max={contract.end_date}
        required
        defaultValue={defaultDate}
      />
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason for ending early')}
        helpText={t('This reason is recorded in the audit log.')}
        required
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

function contractChip(status: VendorContract['status']) {
  return status === 'terminated'
    ? ('contract.terminated' as const)
    : (`amc.${status}` as const);
}

function ContractItem({
  contract,
  today,
  scoped,
  canManage,
  actions,
}: {
  contract: VendorContract;
  today: string;
  scoped: boolean;
  canManage: boolean;
  actions: VendorActions;
}) {
  const { t, money, date } = useVendorPresentation();
  const open =
    contract.status !== 'terminated' && contract.status !== 'expired';
  return (
    <Row>
      <div className="flex flex-wrap items-center gap-space-2">
        <p className="text-body-strong">{contract.scope}</p>
        <StatusChip status={contractChip(contract.status)} />
      </div>
      <p className="text-caption text-ink-muted">
        {scoped ? null : (
          <>
            <a
              href={`${VENDOR_BASE_HREF}/${contract.vendor_id}`}
              className="text-brand underline"
            >
              {contract.vendor_name}
            </a>
            {' · '}
          </>
        )}
        {t('{start} to {end}', {
          start: date(contract.start_date),
          end: date(contract.end_date),
        })}
      </p>
      <p className="text-body">
        {t('{amount} a year, paid {frequency}', {
          amount: money(contract.annual_value_paise),
          frequency: t(FREQUENCY_LABELS[contract.payment_frequency]),
        })}
        {' · '}
        {t(contract.auto_renew ? 'Auto-renews' : 'Does not auto-renew')}
      </p>
      {contract.notice_days !== null && contract.status !== 'terminated' ? (
        <p className="text-caption">
          {t('Give notice by {date} ({count} days before the end).', {
            date: date(contract.notice_deadline),
            count: contract.notice_days,
          })}
        </p>
      ) : null}
      {contract.default_sanctioned_days !== null ||
      contract.deduction_per_day_paise !== null ? (
        <p className="text-caption text-ink-muted">
          {contract.default_sanctioned_days !== null
            ? t('{count} sanctioned days a month', {
                count: contract.default_sanctioned_days,
              })
            : null}
          {contract.default_sanctioned_days !== null &&
          contract.deduction_per_day_paise !== null
            ? ' · '
            : null}
          {contract.deduction_per_day_paise !== null
            ? t('{amount} deducted per missing day', {
                amount: money(contract.deduction_per_day_paise),
              })
            : null}
        </p>
      ) : null}
      {contract.terminated_on ? (
        <p className="text-caption text-warning">
          {t('Ended early on {date}: {reason}', {
            date: date(contract.terminated_on),
            reason: contract.termination_reason ?? '',
          })}
        </p>
      ) : null}
      {contract.successor_id ? (
        <p className="text-caption text-ink-muted">
          {t('Renewed; the renewal is listed separately.')}
        </p>
      ) : null}
      {contract.document_path ? (
        <VendorFileLink
          path={contract.document_path}
          label={t('Contract document')}
          fileLink={actions.fileLink}
        />
      ) : null}
      {canManage && contract.status !== 'terminated' ? (
        <div className="grid gap-space-2">
          <MoreForm label={t('Edit contract')}>
            <ContractForm
              mode="edit"
              contract={contract}
              today={today}
              actions={actions}
            />
          </MoreForm>
          {contract.successor_id ? null : (
            <MoreForm label={t('Renew contract')}>
              <ContractForm
                mode="renew"
                contract={contract}
                today={today}
                actions={actions}
              />
            </MoreForm>
          )}
          {open ? (
            <MoreForm label={t('End early')}>
              <TerminateForm
                contract={contract}
                today={today}
                actions={actions}
              />
            </MoreForm>
          ) : null}
        </div>
      ) : null}
    </Row>
  );
}

export function ContractsView({
  load,
  vendors,
  vendorId,
  actions,
}: {
  load: RegisterLoad<VendorContracts>;
  vendors?: VendorOption[];
  vendorId?: string;
  actions: VendorActions;
}) {
  const { t, date } = useVendorPresentation();
  const title = t('Contracts');
  return (
    <Section id={VENDOR_REGISTER_ANCHORS.contracts}>
      {!load.ok ? (
        <RegisterError title={title} load={load} />
      ) : (
        <Card
          title={title}
          description={t(
            'Renewal alerts use {soon} days for Due Soon and {urgent} days for Urgent.',
            {
              soon: load.data.settings.due_soon_days,
              urgent: load.data.settings.urgent_days,
            },
          )}
        >
          <div className="grid gap-space-4">
            {load.data.contracts.length === 0 ? (
              <EmptyState
                title={t('No contracts yet')}
                description={t(
                  load.data.can_manage
                    ? 'Add a contract below to track its renewal.'
                    : 'An admin adds vendor contracts.',
                )}
              />
            ) : (
              <ul className="grid gap-space-3">
                {load.data.contracts.map((contract) => (
                  <ContractItem
                    key={contract.id}
                    contract={contract}
                    today={load.data.today}
                    scoped={Boolean(vendorId)}
                    canManage={load.data.can_manage}
                    actions={actions}
                  />
                ))}
              </ul>
            )}
            {load.data.amc_contracts.length > 0 ? (
              <div className="grid gap-space-2">
                <h3 className="text-body-strong">{t('AMC contracts')}</h3>
                <ul className="grid gap-space-2">
                  {load.data.amc_contracts.map((amc) => (
                    <li
                      key={amc.id}
                      className="flex flex-wrap items-center gap-space-2 text-body"
                    >
                      <span>
                        {amc.asset_label} · {amc.vendor_name} ·{' '}
                        {t('{start} to {end}', {
                          start: date(amc.start_date),
                          end: date(amc.end_date),
                        })}
                      </span>
                      <StatusChip status={contractChip(amc.status)} />
                    </li>
                  ))}
                </ul>
                <a
                  href="/admin/amc"
                  className="inline-flex min-h-12 w-fit items-center text-brand underline"
                >
                  {t('Manage AMC contracts')}
                </a>
              </div>
            ) : null}
            {load.data.can_manage ? (
              <MoreForm label={t('Add a contract')}>
                <ContractForm
                  mode="new"
                  vendors={vendors}
                  vendorId={vendorId}
                  today={load.data.today}
                  actions={actions}
                />
              </MoreForm>
            ) : null}
          </div>
        </Card>
      )}
    </Section>
  );
}

function StaffCheckForm({
  check,
  contracts,
  actions,
}: {
  check?: VendorStaffDayCheck;
  contracts: VendorContract[];
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  const [contractId, setContractId] = useState(
    check?.contract_id ?? contracts[0]?.id ?? '',
  );
  const contract = contracts.find((item) => item.id === contractId);
  return (
    <ModuleActionForm
      action={actions.saveStaffDayCheck}
      idempotent={!check}
      submitLabel={t(check ? 'Save check' : 'Add check')}
      input={(form, clientRequestId) =>
        vendorStaffDayCheckInputSchema.parse({
          checkId: check?.id ?? null,
          contractId: check?.contract_id ?? contractId,
          month: check?.month ?? `${text(form, 'month')}-01`,
          sanctionedDays: optionalInteger(form, 'sanctionedDays'),
          actualDays: Number(text(form, 'actualDays')),
          contractedAmountPaise: rupeesOrZero(
            form,
            'contractedAmount',
            'contractedAmountPaise',
          ),
          ratePaise: optionalRupees(form, 'rate', 'ratePaise'),
          manualDeductionPaise: optionalRupees(
            form,
            'manualDeduction',
            'manualDeductionPaise',
          ),
          manualDeductionReason: text(form, 'manualDeductionReason'),
          billRaisedPaise:
            text(form, 'billRaised').trim() === ''
              ? null
              : rupeesOrZero(form, 'billRaised', 'billRaisedPaise'),
          editReason: text(form, 'editReason'),
          expectedVersion: check?.version ?? null,
          clientRequestId,
        })
      }
    >
      {check ? null : (
        <>
          <SelectInput
            id={`${id}-contract`}
            name="contractId"
            label={t('Contract')}
            required
            value={contractId}
            onChange={(event) => setContractId(event.currentTarget.value)}
            options={contracts.map((item) => ({
              value: item.id,
              label: `${item.vendor_name} · ${item.scope}`,
            }))}
          />
          <TextInput
            id={`${id}-month`}
            name="month"
            type="month"
            label={t('Month')}
            required
          />
        </>
      )}
      <div key={contractId} className="grid gap-space-3">
        <TextInput
          id={`${id}-sanctioned`}
          name="sanctionedDays"
          type="number"
          min={1}
          max={31}
          label={t('Sanctioned days')}
          helpText={t('Pre-filled from the contract; change it if needed.')}
          required
          defaultValue={
            (
              check?.sanctioned_days ?? contract?.default_sanctioned_days
            )?.toString() ?? ''
          }
        />
        <TextInput
          id={`${id}-actual`}
          name="actualDays"
          type="number"
          min={0}
          max={31}
          label={t('Actual days worked')}
          required
          defaultValue={check?.actual_days.toString() ?? ''}
        />
        <AmountInput
          id={`${id}-contracted`}
          name="contractedAmount"
          label={t('Contracted amount for the month')}
          required
          defaultValue={
            check ? paiseToRupeesInput(check.contracted_amount_paise) : ''
          }
        />
        <AmountInput
          id={`${id}-rate`}
          name="rate"
          label={t('Deduction per missing day (optional)')}
          helpText={t('Use either a per-day rate or a manual deduction.')}
          defaultValue={
            check
              ? check.rate_paise
                ? paiseToRupeesInput(check.rate_paise)
                : ''
              : contract?.deduction_per_day_paise
                ? paiseToRupeesInput(contract.deduction_per_day_paise)
                : ''
          }
        />
        <AmountInput
          id={`${id}-manual`}
          name="manualDeduction"
          label={t('Manual deduction (optional)')}
          defaultValue={
            check?.manual_deduction_paise
              ? paiseToRupeesInput(check.manual_deduction_paise)
              : ''
          }
        />
        <TextInput
          id={`${id}-manual-reason`}
          name="manualDeductionReason"
          label={t('Reason for manual deduction')}
          maxLength={500}
          defaultValue={check?.manual_deduction_reason ?? ''}
        />
        <AmountInput
          id={`${id}-bill`}
          name="billRaised"
          label={t('Bill raised by the agency (optional)')}
          defaultValue={
            check?.bill_raised_paise != null
              ? paiseToRupeesInput(check.bill_raised_paise)
              : ''
          }
        />
      </div>
      {check ? (
        <TextAreaInput
          id={`${id}-edit-reason`}
          name="editReason"
          label={t('Reason for editing')}
          helpText={t('This reason is recorded in the audit log.')}
          required
          maxLength={500}
        />
      ) : null}
    </ModuleActionForm>
  );
}

export function AgencyChecksView({
  load,
  contracts,
  actions,
}: {
  load: RegisterLoad<VendorStaffDayChecks>;
  contracts: VendorContract[];
  actions: VendorActions;
}) {
  const { t, money } = useVendorPresentation();
  const month = useMonth();
  const title = t('Agency checks');
  const pickable = contracts.filter(
    (contract) => contract.status !== 'terminated',
  );
  return (
    <Section id={VENDOR_REGISTER_ANCHORS.checks}>
      {!load.ok ? (
        <RegisterError title={title} load={load} />
      ) : (
        <Card
          title={title}
          description={t(
            'Monthly staff-day checks. Record only; creates no bill or payment.',
          )}
        >
          <div className="grid gap-space-4">
            {load.data.checks.length === 0 ? (
              <EmptyState
                title={t('No agency checks yet')}
                description={t(
                  load.data.can_manage
                    ? 'Record a month below to compare days worked with the bill.'
                    : 'An admin records monthly agency checks.',
                )}
              />
            ) : (
              <ul className="grid gap-space-3">
                {load.data.checks.map((check) => (
                  <Row key={check.id}>
                    <p className="text-body-strong">
                      {check.vendor_name} · {month(check.month)}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {check.contract_scope}
                    </p>
                    <p className="text-body">
                      {t(
                        '{actual} of {sanctioned} days worked · {short} days short',
                        {
                          actual: check.actual_days,
                          sanctioned: check.sanctioned_days,
                          short: check.shortfall_days,
                        },
                      )}
                    </p>
                    <p className="text-body">
                      {t(
                        'Contracted {contracted} · Deduction {deduction} · Payable {payable}',
                        {
                          contracted: money(check.contracted_amount_paise),
                          deduction: money(check.deduction_paise),
                          payable: money(check.payable_paise),
                        },
                      )}
                    </p>
                    {check.manual_deduction_reason ? (
                      <p className="text-caption text-ink-muted">
                        {t('Manual deduction: {reason}', {
                          reason: check.manual_deduction_reason,
                        })}
                      </p>
                    ) : null}
                    <p
                      className={`text-caption ${check.flagged ? 'font-semibold text-warning' : 'text-ink-muted'}`}
                    >
                      {check.bill_raised_paise === null
                        ? t('Agency bill not recorded')
                        : check.flagged
                          ? t(
                              'Agency bill {bill} differs from payable by {variance}',
                              {
                                bill: money(check.bill_raised_paise),
                                variance: money(
                                  Math.abs(check.variance_paise ?? 0),
                                ),
                              },
                            )
                          : t('Agency bill {bill} matches payable', {
                              bill: money(check.bill_raised_paise),
                            })}
                    </p>
                    {load.data.can_manage ? (
                      <MoreForm label={t('Edit check')}>
                        <StaffCheckForm
                          check={check}
                          contracts={contracts}
                          actions={actions}
                        />
                      </MoreForm>
                    ) : null}
                  </Row>
                ))}
              </ul>
            )}
            {load.data.can_manage ? (
              pickable.length > 0 ? (
                <MoreForm label={t('Add an agency check')}>
                  <StaffCheckForm contracts={pickable} actions={actions} />
                </MoreForm>
              ) : (
                <p className="text-caption text-ink-muted">
                  {t('Add a contract first to record agency checks.')}
                </p>
              )
            ) : null}
          </div>
        </Card>
      )}
    </Section>
  );
}

function WorkOrderCreateForm({
  data,
  actions,
}: {
  data: VendorWorkOrders;
  actions: VendorActions;
}) {
  const { t, money } = useVendorPresentation();
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.createWorkOrder}
      idempotent
      submitLabel={t('Issue work order')}
      input={(form, clientRequestId) =>
        vendorWorkOrderCreateInputSchema.parse({
          purchaseRequestId: text(form, 'purchaseRequestId'),
          description: text(form, 'description'),
          valuePaise: optionalRupees(form, 'value', 'valuePaise'),
          issuedOn: text(form, 'issuedOn'),
          dueOn: text(form, 'dueOn'),
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-request`}
        name="purchaseRequestId"
        label={t('Approved purchase request')}
        required
        options={data.approved_requests.map((request) => ({
          value: request.id,
          label: `${request.title} · ${request.vendor_name} · ${money(request.amount_paise)}`,
        }))}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Description (optional)')}
        helpText={t('Leave blank to use the request title.')}
        maxLength={2000}
      />
      <AmountInput
        id={`${id}-value`}
        name="value"
        label={t('Value (optional)')}
        helpText={t('Leave blank to use the selected quote amount.')}
      />
      <TextInput
        id={`${id}-issued`}
        name="issuedOn"
        type="date"
        label={t('Issue date')}
        required
        defaultValue={data.today}
      />
      <TextInput
        id={`${id}-due`}
        name="dueOn"
        type="date"
        label={t('Due date (optional)')}
      />
    </ModuleActionForm>
  );
}

function WorkOrderManage({
  order,
  today,
  actions,
}: {
  order: VendorWorkOrder;
  today: string;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  return (
    <div className="grid gap-space-2">
      {order.status === 'issued' ? (
        <VendorQuickAction
          action={actions.setWorkOrderStatus}
          input={vendorWorkOrderStatusInputSchema.parse({
            workOrderId: order.id,
            status: 'in_progress',
            completedOn: null,
            reason: null,
            expectedVersion: order.version,
          })}
          label={t('Mark in progress')}
        />
      ) : null}
      <MoreForm label={t('Mark completed')}>
        <ModuleActionForm
          action={actions.setWorkOrderStatus}
          submitLabel={t('Mark completed')}
          input={(form) =>
            vendorWorkOrderStatusInputSchema.parse({
              workOrderId: order.id,
              status: 'completed',
              completedOn: text(form, 'completedOn'),
              reason: null,
              expectedVersion: order.version,
            })
          }
        >
          <TextInput
            id={`${id}-completed`}
            name="completedOn"
            type="date"
            label={t('Completion date')}
            min={order.issued_on}
            max={today}
            required
            defaultValue={today}
          />
        </ModuleActionForm>
      </MoreForm>
      <MoreForm label={t('Edit work order')}>
        <ModuleActionForm
          action={actions.updateWorkOrder}
          submitLabel={t('Save work order')}
          input={(form) =>
            vendorWorkOrderUpdateInputSchema.parse({
              workOrderId: order.id,
              description: text(form, 'description'),
              dueOn: text(form, 'dueOn'),
              expectedVersion: order.version,
            })
          }
        >
          <TextAreaInput
            id={`${id}-description`}
            name="description"
            label={t('Description')}
            required
            maxLength={2000}
            defaultValue={order.description}
          />
          <TextInput
            id={`${id}-due`}
            name="dueOn"
            type="date"
            label={t('Due date (optional)')}
            min={order.issued_on}
            defaultValue={order.due_on ?? ''}
          />
        </ModuleActionForm>
      </MoreForm>
      <MoreForm label={t('Cancel work order')}>
        <ModuleActionForm
          action={actions.setWorkOrderStatus}
          submitLabel={t('Cancel work order')}
          confirmMessage={t(
            'Cancel this work order? It stays in the register with the reason.',
          )}
          input={(form) =>
            vendorWorkOrderStatusInputSchema.parse({
              workOrderId: order.id,
              status: 'cancelled',
              completedOn: null,
              reason: text(form, 'reason'),
              expectedVersion: order.version,
            })
          }
        >
          <TextAreaInput
            id={`${id}-reason`}
            name="reason"
            label={t('Reason for cancelling')}
            helpText={t('This reason is recorded in the audit log.')}
            required
            maxLength={500}
          />
        </ModuleActionForm>
      </MoreForm>
    </div>
  );
}

export function WorkOrdersView({
  load,
  scoped = false,
  actions,
}: {
  load: RegisterLoad<VendorWorkOrders>;
  scoped?: boolean;
  actions: VendorActions;
}) {
  const { t, money, date } = useVendorPresentation();
  const title = t('Work orders');
  return (
    <Section id={VENDOR_REGISTER_ANCHORS.workOrders}>
      {!load.ok ? (
        <RegisterError title={title} load={load} />
      ) : (
        <Card
          title={title}
          description={t('Issued from approved purchase requests.')}
        >
          <div className="grid gap-space-4">
            {load.data.work_orders.length === 0 ? (
              <EmptyState
                title={t('No work orders yet')}
                description={t(
                  load.data.can_manage
                    ? 'Issue one below from an approved purchase request.'
                    : 'An admin issues work orders from approved purchase requests.',
                )}
              />
            ) : (
              <ul className="grid gap-space-3">
                {load.data.work_orders.map((order) => (
                  <Row key={order.id}>
                    <div className="flex flex-wrap items-center gap-space-2">
                      <p className="text-body-strong">{order.number}</p>
                      <StatusChip status={`work_order.${order.status}`} />
                    </div>
                    <p className="text-body">{order.description}</p>
                    <p className="text-caption text-ink-muted">
                      <a
                        href={`${VENDOR_BASE_HREF}/requests/${order.purchase_request_id}`}
                        className="text-brand underline"
                      >
                        {order.request_title}
                      </a>
                      {scoped ? '' : ` · ${order.vendor_name}`} ·{' '}
                      {money(order.value_paise)}
                    </p>
                    <p className="text-caption">
                      {t('Issued {date}', { date: date(order.issued_on) })} ·{' '}
                      {order.due_on
                        ? t('Due {date}', { date: date(order.due_on) })
                        : t('No due date')}
                      {order.completed_on
                        ? ` · ${t('Completed {date}', { date: date(order.completed_on) })}`
                        : ''}
                    </p>
                    <p className="text-caption">
                      {order.days_open === null
                        ? null
                        : `${t('{count} days open', { count: order.days_open })} · `}
                      {t('Delay: {delay}', {
                        delay:
                          order.delay_days === null
                            ? '—'
                            : t('{count} days', { count: order.delay_days }),
                      })}
                    </p>
                    {order.cancel_reason ? (
                      <p className="text-caption text-ink-muted">
                        {t('Cancelled: {reason}', {
                          reason: order.cancel_reason,
                        })}
                      </p>
                    ) : null}
                    {load.data.can_manage &&
                    (order.status === 'issued' ||
                      order.status === 'in_progress') ? (
                      <WorkOrderManage
                        order={order}
                        today={load.data.today}
                        actions={actions}
                      />
                    ) : null}
                  </Row>
                ))}
              </ul>
            )}
            {load.data.can_manage ? (
              load.data.approved_requests.length > 0 ? (
                <MoreForm label={t('Issue a work order')}>
                  <WorkOrderCreateForm data={load.data} actions={actions} />
                </MoreForm>
              ) : (
                <p className="text-caption text-ink-muted">
                  {t(
                    'No approved purchase requests are waiting for a work order.',
                  )}
                </p>
              )
            ) : null}
          </div>
        </Card>
      )}
    </Section>
  );
}

function BillForm({
  bill,
  vendors,
  vendorId,
  today,
  actions,
}: {
  bill?: VendorBill;
  vendors?: VendorOption[];
  vendorId?: string;
  today: string;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const id = useId();
  const pickVendor = !bill && !vendorId;
  return (
    <ModuleActionForm
      action={actions.saveBill}
      idempotent={!bill}
      submitLabel={t(bill ? 'Save bill' : 'Add bill')}
      input={(form, clientRequestId) =>
        vendorBillInputSchema.parse({
          billId: bill?.id ?? null,
          vendorId: bill?.vendor_id ?? vendorId ?? text(form, 'vendorId'),
          invoiceNumber: text(form, 'invoiceNumber'),
          invoiceDate: text(form, 'invoiceDate'),
          amountPaise: readRupees(form, 'amount', 'amountPaise'),
          expectedVersion: bill?.version ?? null,
          clientRequestId,
        })
      }
    >
      {pickVendor ? (
        <SelectInput
          id={`${id}-vendor`}
          name="vendorId"
          label={t('Vendor')}
          required
          defaultValue=""
          options={[
            { value: '', label: t('Choose a vendor') },
            ...(vendors ?? []).map((vendor) => ({
              value: vendor.id,
              label: vendor.name,
            })),
          ]}
        />
      ) : null}
      <TextInput
        id={`${id}-number`}
        name="invoiceNumber"
        label={t('Invoice number')}
        required
        maxLength={60}
        defaultValue={bill?.invoice_number ?? ''}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-date`}
        name="invoiceDate"
        type="date"
        label={t('Invoice date')}
        required
        defaultValue={bill?.invoice_date ?? today}
      />
      <AmountInput
        id={`${id}-amount`}
        name="amount"
        label={t('Amount')}
        required
        defaultValue={bill ? paiseToRupeesInput(bill.amount_paise) : ''}
      />
    </ModuleActionForm>
  );
}

function BillLinkForm({
  bill,
  entries,
  actions,
}: {
  bill: VendorBill;
  entries: VendorBills['linkable_entries'];
  actions: VendorActions;
}) {
  const { t, money, date } = useVendorPresentation();
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.linkBillPayment}
      idempotent
      submitLabel={t('Link payment')}
      input={(form, clientRequestId) =>
        vendorBillPaymentLinkInputSchema.parse({
          billId: bill.id,
          entryId: text(form, 'entryId'),
          amountPaise: readRupees(form, 'amount', 'amountPaise'),
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-entry`}
        name="entryId"
        label={t('Cash-book payment')}
        required
        options={entries.map((entry) => ({
          value: entry.id,
          label: `${date(entry.entry_date)} · ${entry.payee ?? t('No payee')} · ${t('{amount} not yet linked', { amount: money(entry.unlinked_paise) })}`,
        }))}
      />
      <AmountInput
        id={`${id}-amount`}
        name="amount"
        label={t('Amount to link')}
        helpText={t('Up to the bill balance and the unlinked amount.')}
        required
        defaultValue={paiseToRupeesInput(bill.outstanding_paise)}
      />
    </ModuleActionForm>
  );
}

function BillItem({
  bill,
  data,
  scoped,
  actions,
}: {
  bill: VendorBill;
  data: VendorBills;
  scoped: boolean;
  actions: VendorActions;
}) {
  const { t, money, date } = useVendorPresentation();
  const id = useId();
  const cancelled = bill.cancelled_at !== null;
  const editable = data.can_manage && !cancelled && bill.paid_paise === 0;
  return (
    <Row>
      <div className="flex flex-wrap items-center gap-space-2">
        <p className="text-body-strong">
          {scoped ? null : `${bill.vendor_name} · `}
          {bill.invoice_number}
        </p>
        {cancelled ? (
          <StatusChip status="vendor_bill.cancelled" />
        ) : (
          <>
            <StatusChip status={`vendor_bill.${bill.payment_status}`} />
            {bill.due_state ? (
              <StatusChip status={`vendor_bill.${bill.due_state}`} />
            ) : null}
          </>
        )}
      </div>
      <p className="text-body">
        {t('{amount} · invoice {date} · due {due}', {
          amount: money(bill.amount_paise),
          date: date(bill.invoice_date),
          due: date(bill.due_date),
        })}
      </p>
      {cancelled ? (
        <p className="text-caption text-ink-muted">
          {t('Cancelled: {reason}', { reason: bill.cancel_reason ?? '' })}
        </p>
      ) : (
        <p className="text-caption">
          {t('Paid {paid} · Outstanding {outstanding}', {
            paid: money(bill.paid_paise),
            outstanding: money(bill.outstanding_paise),
          })}
        </p>
      )}
      {bill.payments.length > 0 ? (
        <ul className="grid gap-space-2">
          {bill.payments.map((payment) => (
            <li
              key={payment.id}
              className="grid gap-space-1 border-l-2 border-rule pl-space-3 text-caption"
            >
              <span>
                {date(payment.entry_date)} · {payment.payee ?? t('No payee')} ·{' '}
                {money(payment.amount_paise)}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </span>
              {payment.unlinked_at ? (
                <span className="text-ink-muted">
                  {t('Unlinked – not counted')}
                  {payment.unlink_reason ? `: ${payment.unlink_reason}` : ''}
                </span>
              ) : !payment.counting ? (
                <span className="text-ink-muted">
                  {t('Reversed – not counted')}
                </span>
              ) : data.can_manage ? (
                <MoreForm label={t('Unlink payment')}>
                  <ModuleActionForm
                    action={actions.unlinkBillPayment}
                    submitLabel={t('Unlink payment')}
                    input={(form) =>
                      vendorBillPaymentUnlinkInputSchema.parse({
                        paymentId: payment.id,
                        reason: text(form, 'reason'),
                      })
                    }
                  >
                    <TextAreaInput
                      id={`${id}-${payment.id}-reason`}
                      name="reason"
                      label={t('Reason for unlinking')}
                      helpText={t('This reason is recorded in the audit log.')}
                      required
                      maxLength={500}
                    />
                  </ModuleActionForm>
                </MoreForm>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {data.can_manage && !cancelled && bill.outstanding_paise > 0 ? (
        data.linkable_entries.length > 0 ? (
          <MoreForm label={t('Link a payment')}>
            <BillLinkForm
              bill={bill}
              entries={data.linkable_entries}
              actions={actions}
            />
          </MoreForm>
        ) : (
          <p className="text-caption text-ink-muted">
            {t('No unlinked cash-book payments to link.')}
          </p>
        )
      ) : null}
      {editable ? (
        <>
          <MoreForm label={t('Edit bill')}>
            <BillForm bill={bill} today={data.today} actions={actions} />
          </MoreForm>
          <MoreForm label={t('Cancel bill')}>
            <ModuleActionForm
              action={actions.cancelBill}
              submitLabel={t('Cancel bill')}
              confirmMessage={t(
                'Cancel this bill? It stays in the register with the reason.',
              )}
              input={(form) =>
                vendorBillCancelInputSchema.parse({
                  billId: bill.id,
                  reason: text(form, 'reason'),
                  expectedVersion: bill.version,
                })
              }
            >
              <TextAreaInput
                id={`${id}-cancel-reason`}
                name="reason"
                label={t('Reason for cancelling')}
                helpText={t('This reason is recorded in the audit log.')}
                required
                maxLength={500}
              />
            </ModuleActionForm>
          </MoreForm>
        </>
      ) : null}
    </Row>
  );
}

export function BillsView({
  load,
  vendors,
  vendorId,
  actions,
}: {
  load: RegisterLoad<VendorBills>;
  vendors?: VendorOption[];
  vendorId?: string;
  actions: VendorActions;
}) {
  const { t } = useVendorPresentation();
  const title = t('Bills owed');
  return (
    <Section id={VENDOR_REGISTER_ANCHORS.bills}>
      {!load.ok ? (
        <RegisterError title={title} load={load} />
      ) : (
        <Card
          title={title}
          description={t(
            'Paid status comes only from linked cash-book payments.',
          )}
        >
          <div className="grid gap-space-4">
            {load.data.bills.length === 0 ? (
              <EmptyState
                title={t('No bills recorded')}
                description={t(
                  load.data.can_manage
                    ? 'Add a vendor bill below to track what is owed.'
                    : 'An admin records vendor bills.',
                )}
              />
            ) : (
              <ul className="grid gap-space-3">
                {load.data.bills.map((bill) => (
                  <BillItem
                    key={bill.id}
                    bill={bill}
                    data={load.data}
                    scoped={Boolean(vendorId)}
                    actions={actions}
                  />
                ))}
              </ul>
            )}
            {load.data.can_manage ? (
              <MoreForm label={t('Add a bill')}>
                <BillForm
                  vendors={vendors}
                  vendorId={vendorId}
                  today={load.data.today}
                  actions={actions}
                />
              </MoreForm>
            ) : null}
          </div>
        </Card>
      )}
    </Section>
  );
}

/** Groups the register reads a page needs so pages pass one prop. */
export type VendorRegisterLoads = {
  summary: RegisterLoad<VendorSummary>;
  contracts: RegisterLoad<VendorContracts>;
  checks: RegisterLoad<VendorStaffDayChecks>;
  workOrders: RegisterLoad<VendorWorkOrders>;
  bills: RegisterLoad<VendorBills>;
};

export function VendorRegisters({
  registers,
  vendors,
  vendorId,
  actions,
}: {
  registers: VendorRegisterLoads;
  vendors?: VendorOption[];
  vendorId?: string;
  actions: VendorActions;
}) {
  const contracts = registers.contracts.ok
    ? registers.contracts.data.contracts
    : [];
  return (
    <>
      <ContractsView
        load={registers.contracts}
        vendors={vendors}
        vendorId={vendorId}
        actions={actions}
      />
      <AgencyChecksView
        load={registers.checks}
        contracts={contracts}
        actions={actions}
      />
      <WorkOrdersView
        load={registers.workOrders}
        scoped={Boolean(vendorId)}
        actions={actions}
      />
      <BillsView
        load={registers.bills}
        vendors={vendors}
        vendorId={vendorId}
        actions={actions}
      />
    </>
  );
}
