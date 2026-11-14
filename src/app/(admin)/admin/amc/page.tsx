// Show administrator AMC management and committee read-only contract history.
import { Card } from '@/components/ui/data-display';
import { AmcContractForm, AmcVisitForm } from '@/components/amc/controls';
import { getAmcWorkspace, filterAmcContracts } from '@/core/amc/operations';
import { formatRupees } from '@/core/billing/format';
export const metadata = {
  title: 'AMC | Homeish',
  robots: { index: false, follow: false },
};
export default async function AmcPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vendor?: string; asset?: string }>;
}) {
  const search = await searchParams;
  const w = await getAmcWorkspace();
  const contracts = filterAmcContracts(w.contracts, search);
  const query = new URLSearchParams(
    Object.entries(search).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">AMC contracts</h1>
      {!w.can_manage ? (
        <p>Read-only committee access.</p>
      ) : (
        <Card title="Add contract">
          <AmcContractForm today={w.today} />
        </Card>
      )}
      <Card title="Filter and export">
        <form method="get" className="grid min-w-0 gap-space-3">
          <label htmlFor="amc-status">Status</label>
          <select
            id="amc-status"
            name="status"
            defaultValue={search.status ?? ''}
            className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Expired</option>
          </select>
          <label htmlFor="amc-asset">Asset</label>
          <input
            id="amc-asset"
            name="asset"
            defaultValue={search.asset}
            className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
          />
          <label htmlFor="amc-vendor">Vendor</label>
          <input
            id="amc-vendor"
            name="vendor"
            defaultValue={search.vendor}
            className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
          />
          <button
            type="submit"
            className="min-h-12 rounded-md border border-rule"
          >
            Show contracts
          </button>
        </form>
        <div className="mt-space-3 flex flex-wrap gap-space-3">
          {['contracts', 'visits'].map((type) => (
            <a
              key={type}
              className="text-brand underline"
              href={`/api/amc/export?${query}&type=${type}`}
            >
              Download {type} CSV
            </a>
          ))}
        </div>
      </Card>
      {contracts.length ? (
        contracts.map((c) => (
          <Card key={c.id} title={`${c.asset_label} · ${c.status}`}>
            <div className="grid min-w-0 gap-space-3">
              <p>
                {c.vendor_name} · {c.vendor_contact}
              </p>
              <p>
                {c.start_date} to {c.end_date} · {formatRupees(c.cost_paise)}
              </p>
              <p>
                Payment terms: {c.payment_terms || 'Not specified'} · Visits:{' '}
                {c.visit_frequency}
              </p>
              {c.predecessor_id ? (
                <p>Renewal of contract {c.predecessor_id}</p>
              ) : null}
              {c.successor_id ? (
                <p>A successor contract preserves this contract history.</p>
              ) : null}
              {c.documentUrl ? (
                <a
                  href={c.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  View private contract document
                </a>
              ) : null}
              {w.can_manage ? (
                <details>
                  <summary className="cursor-pointer">Edit contract</summary>
                  <AmcContractForm
                    key={c.updated_at}
                    contract={c}
                    today={w.today}
                  />
                </details>
              ) : null}
              {w.can_manage && !c.successor_id ? (
                <details>
                  <summary className="cursor-pointer">Renew contract</summary>
                  <AmcContractForm contract={c} renew today={w.today} />
                </details>
              ) : null}
              <h2 className="text-body-strong">Service visits</h2>
              {w.visits
                .filter((v) => v.contract_id === c.id)
                .map((v) => (
                  <div
                    key={v.id}
                    className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
                  >
                    <p>
                      {v.visit_date} · {v.technician}
                    </p>
                    <p className="break-words">{v.summary}</p>
                    {v.documentUrl ? (
                      <a
                        href={v.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline"
                      >
                        View private visit report
                      </a>
                    ) : null}
                    {w.can_manage ? (
                      <details>
                        <summary className="cursor-pointer">
                          Correct visit
                        </summary>
                        <AmcVisitForm
                          key={v.updated_at}
                          contractId={c.id}
                          visit={v}
                          today={w.today}
                        />
                      </details>
                    ) : null}
                  </div>
                ))}
              {w.can_manage ? (
                <details>
                  <summary className="cursor-pointer">
                    Record service visit
                  </summary>
                  <AmcVisitForm contractId={c.id} today={w.today} />
                </details>
              ) : null}
            </div>
          </Card>
        ))
      ) : (
        <p>No contracts match these filters.</p>
      )}
    </section>
  );
}
