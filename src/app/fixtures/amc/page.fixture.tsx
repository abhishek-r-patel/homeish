// Exercise AMC renewals and visit corrections with development-only in-memory history.
'use client';
import { useState } from 'react';
import {
  AmcContractForm,
  AmcExpirySettingsForm,
  AmcScheduleForm,
  AmcVisitForm,
} from '@/components/amc/controls';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  amcContractInputSchema,
  amcExpirySettingsInputSchema,
  amcScheduleInputSchema,
  amcVisitInputSchema,
  DEFAULT_AMC_SETTINGS,
  type AmcContract,
  type AmcVisit,
} from '@/core/amc/validation';
const today = new Date().toISOString().slice(0, 10);
const CATEGORIES = [
  { id: 'd0d55fc3-0751-4b79-86c1-5b3e25942392', name: 'Lift', active: true },
  { id: 'd1d55fc3-0751-4b79-86c1-5b3e25942392', name: 'Pump', active: true },
];
const UNSCHEDULED = {
  amc_type: null,
  asset_category_id: null,
  services_per_year: null,
  asset_category_name: null,
  last_visit_date: null,
  next_service_date: null,
  service_overdue: false,
} satisfies Partial<AmcContract>;
/** Mirrors the database rule: next service = last visit + round(365 / services per year) days. */
function withSchedule(contract: AmcContract, visits: AmcVisit[]): AmcContract {
  const last =
    visits
      .filter((visit) => visit.contract_id === contract.id)
      .map((visit) => visit.visit_date)
      .sort()
      .at(-1) ?? null;
  const next =
    last && contract.services_per_year
      ? new Date(
          Date.parse(`${last}T00:00:00Z`) +
            Math.round(365 / contract.services_per_year) * 86_400_000,
        )
          .toISOString()
          .slice(0, 10)
      : null;
  return {
    ...contract,
    last_visit_date: last,
    next_service_date: next,
    service_overdue: next !== null && next < today,
  };
}
function input(data: FormData): unknown {
  const raw = data.get('input');
  if (typeof raw !== 'string') throw new Error('Missing fixture input.');
  return JSON.parse(raw);
}
export default function AmcFixturePage() {
  const [contracts, setContracts] = useState<AmcContract[]>([]);
  const [visits, setVisits] = useState<AmcVisit[]>([]);
  const [expirySettings, setExpirySettings] = useState({
    due_soon_days: DEFAULT_AMC_SETTINGS.due_soon_days,
    urgent_days: DEFAULT_AMC_SETTINGS.urgent_days,
  });
  const saveExpirySettings: ModuleFormAction = async (data) => {
    const parsed = amcExpirySettingsInputSchema.safeParse(input(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    setExpirySettings({
      due_soon_days: parsed.data.dueSoonDays,
      urgent_days: parsed.data.urgentDays,
    });
    return { ok: true, message: 'AMC expiry windows saved.' };
  };
  const save: ModuleFormAction = async (data) => {
    const parsed = amcContractInputSchema.safeParse(input(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    const v = parsed.data;
    const contract: AmcContract = {
      id: v.contractId ?? crypto.randomUUID(),
      asset_label: v.assetLabel,
      vendor_name: v.vendorName,
      vendor_contact: v.vendorContact,
      start_date: v.startDate,
      end_date: v.endDate,
      cost_paise: v.costRupees,
      payment_terms: v.paymentTerms,
      visit_frequency: v.visitFrequency,
      document_path: v.documentPath,
      predecessor_id: v.predecessorId,
      successor_id: null,
      updated_at: new Date().toISOString(),
      status: 'active',
      ...UNSCHEDULED,
    };
    const previous = contracts.find((row) => row.id === v.contractId);
    if (previous) {
      contract.amc_type = previous.amc_type;
      contract.asset_category_id = previous.asset_category_id;
      contract.asset_category_name = previous.asset_category_name;
      contract.services_per_year = previous.services_per_year;
    }
    setContracts((rows) => [
      ...rows
        .filter((r) => r.id !== contract.id)
        .map((r) =>
          r.id === v.predecessorId ? { ...r, successor_id: contract.id } : r,
        ),
      contract,
    ]);
    return { ok: true, message: 'AMC contract saved.' };
  };
  const saveVisit: ModuleFormAction = async (data) => {
    const parsed = amcVisitInputSchema.safeParse(input(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    const v = parsed.data;
    const visit: AmcVisit = {
      id: v.visitId ?? crypto.randomUUID(),
      contract_id: v.contractId,
      visit_date: v.visitDate,
      summary: v.summary,
      technician: v.technician,
      document_path: v.documentPath,
      updated_at: new Date().toISOString(),
    };
    setVisits((rows) => [...rows.filter((r) => r.id !== visit.id), visit]);
    return { ok: true, message: 'Service visit saved.' };
  };
  const saveSchedule: ModuleFormAction = async (data) => {
    const parsed = amcScheduleInputSchema.safeParse(input(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    const v = parsed.data;
    setContracts((rows) =>
      rows.map((row) =>
        row.id === v.contractId
          ? {
              ...row,
              amc_type: v.amcType,
              asset_category_id: v.assetCategoryId,
              asset_category_name:
                CATEGORIES.find((category) => category.id === v.assetCategoryId)
                  ?.name ?? null,
              services_per_year: v.servicesPerYear,
              updated_at: new Date().toISOString(),
            }
          : row,
      ),
    );
    return { ok: true, message: 'Service schedule saved.' };
  };
  const scheduled = contracts.map((contract) => withSchedule(contract, visits));
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic AMC fixture" tone="info">
        Development-only simulated actions. No database writes. Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">AMC workflows</h1>
      <section
        aria-label="AMC expiry settings"
        className="grid min-w-0 gap-space-3"
      >
        <h2 className="text-heading font-semibold">AMC expiry windows</h2>
        <AmcExpirySettingsForm
          settings={expirySettings}
          action={saveExpirySettings}
        />
      </section>
      <section aria-label="New contract" className="grid min-w-0 gap-space-3">
        <h2 className="text-heading font-semibold">New contract</h2>
        <AmcContractForm today={today} action={save} />
      </section>
      <p>Contract history count: {contracts.length}</p>
      {scheduled.map((c) => (
        <section
          key={c.id}
          aria-label={
            c.predecessor_id ? 'Successor history' : 'Original history'
          }
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">{c.asset_label}</h2>
          <p>Contract ending {c.end_date}</p>
          <p>
            Services per year: {c.services_per_year ?? 'Not set'} · Asset type:{' '}
            {c.asset_category_name ?? 'Not set'} · Next service:{' '}
            {c.next_service_date ?? 'Unscheduled'}
            {c.service_overdue ? ' · Service overdue' : ''}
          </p>
          <AmcScheduleForm
            key={c.updated_at}
            contract={c}
            categories={CATEGORIES}
            action={saveSchedule}
          />
          {visits
            .filter((v) => v.contract_id === c.id)
            .map((v) => (
              <div key={v.id} className="grid min-w-0 gap-space-3">
                <p>Visit: {v.summary}</p>
                <AmcVisitForm
                  contractId={c.id}
                  visit={v}
                  today={today}
                  action={saveVisit}
                />
              </div>
            ))}
          <AmcVisitForm contractId={c.id} today={today} action={saveVisit} />
          {!c.successor_id ? (
            <AmcContractForm contract={c} renew today={today} action={save} />
          ) : (
            <p>Renewed; original history retained.</p>
          )}
        </section>
      ))}
    </main>
  );
}
