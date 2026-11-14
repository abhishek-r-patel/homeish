// Exercise AMC renewals and visit corrections with development-only in-memory history.
'use client';
import { useState } from 'react';
import { AmcContractForm, AmcVisitForm } from '@/components/amc/controls';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  amcContractInputSchema,
  amcVisitInputSchema,
  type AmcContract,
  type AmcVisit,
} from '@/core/amc/validation';
const today = new Date().toISOString().slice(0, 10);
function input(data: FormData): unknown {
  const raw = data.get('input');
  if (typeof raw !== 'string') throw new Error('Missing fixture input.');
  return JSON.parse(raw);
}
export default function AmcFixturePage() {
  const [contracts, setContracts] = useState<AmcContract[]>([]);
  const [visits, setVisits] = useState<AmcVisit[]>([]);
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
    };
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
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic AMC fixture" tone="info">
        Development-only simulated actions. No database writes. Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">AMC workflows</h1>
      <section aria-label="New contract" className="grid min-w-0 gap-space-3">
        <h2 className="text-heading font-semibold">New contract</h2>
        <AmcContractForm today={today} action={save} />
      </section>
      <p>Contract history count: {contracts.length}</p>
      {contracts.map((c) => (
        <section
          key={c.id}
          aria-label={
            c.predecessor_id ? 'Successor history' : 'Original history'
          }
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">{c.asset_label}</h2>
          <p>Contract ending {c.end_date}</p>
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
