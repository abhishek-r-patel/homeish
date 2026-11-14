// Show authorized current stock, usage reports and append-only transaction history.
import { Card } from '@/components/ui/data-display';
import { InventoryItemForm, StockTransactionForm } from './controls';
import {
  getInventoryReport,
  getInventoryWorkspace,
} from '@/core/housekeeping/operations';
import {
  quantityThousandths,
  formatStockQuantity,
} from '@/core/housekeeping/validation';
import { formatRupees } from '@/core/billing/format';

export type InventorySearch = { from?: string; to?: string; itemId?: string };
export async function InventoryWorkspace({
  search,
}: {
  search: InventorySearch;
}) {
  const workspace = await getInventoryWorkspace();
  const from = search.from ?? `${workspace.today.slice(0, 7)}-01`;
  const to = search.to ?? workspace.today;
  const report = await getInventoryReport({
    from,
    to,
    itemId: search.itemId || null,
  });
  const query = new URLSearchParams({
    from,
    to,
    ...(search.itemId ? { itemId: search.itemId } : {}),
  });
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header>
        <h1 className="text-title font-semibold">Housekeeping inventory</h1>
        <p className="text-body text-ink-muted">
          Track receipts, usage and adjustments without changing stock history.
        </p>
      </header>
      {workspace.canManage ? (
        <Card title="Add inventory item">
          <InventoryItemForm />
        </Card>
      ) : (
        <p className="text-body text-ink-muted">
          Read-only access. Administrators and housekeeping supervisors manage
          inventory.
        </p>
      )}
      <Card title="Current stock">
        {workspace.items.length ? (
          <ul className="grid gap-space-3">
            {workspace.items.map((item) => (
              <li
                key={item.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <h2 className="text-body-strong">{item.name}</h2>
                <p>
                  {item.stock} {item.unit_of_measure} · Minimum{' '}
                  {item.minimum_stock} · {item.category}
                </p>
                {item.low_stock ? (
                  <p className="text-caption text-warning">Low stock</p>
                ) : null}
                {!item.active ? (
                  <p className="text-caption text-ink-muted">Inactive</p>
                ) : null}
                {workspace.canManage ? (
                  <details>
                    <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-focus">
                      Manage {item.name}
                    </summary>
                    <div className="mt-space-3 grid gap-space-4">
                      <InventoryItemForm key={item.updated_at} item={item} />
                      {item.active ? (
                        <StockTransactionForm
                          item={item}
                          today={workspace.today}
                        />
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No inventory items have been added.</p>
        )}
      </Card>
      <Card title="Reports and transaction history">
        <form method="get" className="grid gap-space-3 sm:grid-cols-2">
          <label className="grid gap-space-1" htmlFor="inventory-from">
            From date
            <input
              className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
              id="inventory-from"
              name="from"
              type="date"
              required
              defaultValue={from}
            />
          </label>
          <label className="grid gap-space-1" htmlFor="inventory-to">
            To date
            <input
              className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
              id="inventory-to"
              name="to"
              type="date"
              required
              defaultValue={to}
            />
          </label>
          <label className="grid gap-space-1" htmlFor="inventory-item">
            Item
            <select
              className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
              id="inventory-item"
              name="itemId"
              defaultValue={search.itemId ?? ''}
            >
              <option value="">All items</option>
              {workspace.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-12 rounded-md border border-rule px-space-3 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
            type="submit"
          >
            Show report
          </button>
        </form>
        <div className="mt-space-3 flex flex-wrap gap-space-3">
          {['stock', 'usage', 'low_stock', 'transactions'].map((type) => (
            <a
              className="min-h-12 rounded-sm text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
              href={`/api/housekeeping/export?${query}&type=${type}`}
              key={type}
            >
              Download {type.replace('_', ' ')} CSV
            </a>
          ))}
        </div>
        <ul className="mt-space-3 grid gap-space-2">
          {report.items.map((item) => {
            const usage = report.transactions
              .filter((row) => row.item_id === item.id && row.kind === 'out')
              .reduce(
                (sum, row) => sum - quantityThousandths(row.quantity),
                BigInt(0),
              );
            return (
              <li key={item.id}>
                {item.name}: used {formatStockQuantity(usage)}{' '}
                {item.unit_of_measure} in this date range
              </li>
            );
          })}
        </ul>
        {report.transactions.length ? (
          <ul className="mt-space-4 grid gap-space-3">
            {report.transactions.map((row) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={row.id}
              >
                <p className="text-body-strong">
                  {row.item_name} · {row.kind} · {row.quantity}{' '}
                  {row.unit_of_measure}
                </p>
                <p className="text-caption">
                  {row.effective_date} ·{' '}
                  {row.vendor ?? row.purpose ?? 'Receipt'}
                  {row.cost_paise !== null
                    ? ` · ${formatRupees(row.cost_paise)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-space-3 text-ink-muted">
            No transactions match this date range.
          </p>
        )}
      </Card>
    </section>
  );
}
