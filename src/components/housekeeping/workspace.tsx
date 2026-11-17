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
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

const CATEGORY_LABELS = {
  cleaning: 'Cleaning',
  tools: 'Tools',
  consumables: 'Consumables',
  other: 'Other',
} as const;
const TRANSACTION_LABELS = {
  in: 'Stock in',
  out: 'Stock out',
  adjustment: 'Adjustment',
} as const;
const EXPORTS = [
  { type: 'stock', label: 'Download stock CSV' },
  { type: 'usage', label: 'Download usage CSV' },
  { type: 'low_stock', label: 'Download low stock CSV' },
  { type: 'transactions', label: 'Download transactions CSV' },
] as const;

export type InventorySearch = { from?: string; to?: string; itemId?: string };
export async function InventoryWorkspace({
  search,
}: {
  search: InventorySearch;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const formatQuantity = (value: string) => {
    const [whole, fraction] = value.replace(/^-/, '').split('.');
    return `${value.startsWith('-') ? '-' : ''}${formatLocalizedNumber(BigInt(whole!), locale)}${fraction ? `.${fraction}` : ''}`;
  };
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
        <h1 className="text-title font-semibold">
          {t('Housekeeping inventory')}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            'Track receipts, usage and adjustments without changing stock history.',
          )}
        </p>
      </header>
      {workspace.canManage ? (
        <Card title={t('Add inventory item')}>
          <InventoryItemForm />
        </Card>
      ) : (
        <p className="text-body text-ink-muted">
          {t(
            'Read-only access. Administrators and housekeeping supervisors manage inventory.',
          )}
        </p>
      )}
      <Card title={t('Current stock')}>
        {workspace.items.length ? (
          <ul className="grid gap-space-3">
            {workspace.items.map((item) => (
              <li
                key={item.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <h2 className="text-body-strong">{item.name}</h2>
                <p>
                  {t('{stock} {unit} · Minimum {minimum} · {category}', {
                    stock: formatQuantity(item.stock),
                    unit: item.unit_of_measure,
                    minimum: formatQuantity(item.minimum_stock),
                    category: t(CATEGORY_LABELS[item.category]),
                  })}
                </p>
                {item.low_stock ? (
                  <p className="text-caption text-warning">{t('Low stock')}</p>
                ) : null}
                {!item.active ? (
                  <p className="text-caption text-ink-muted">{t('Inactive')}</p>
                ) : null}
                {workspace.canManage ? (
                  <details>
                    <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-focus">
                      {t('Manage {name}', { name: item.name })}
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
          <p>{t('No inventory items have been added.')}</p>
        )}
      </Card>
      <Card title={t('Reports and transaction history')}>
        <form method="get" className="grid gap-space-3 sm:grid-cols-2">
          <label className="grid gap-space-1" htmlFor="inventory-from">
            {t('From date')}
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
            {t('To date')}
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
            {t('Item')}
            <select
              className="min-h-12 min-w-0 rounded-md border border-rule px-space-3"
              id="inventory-item"
              name="itemId"
              defaultValue={search.itemId ?? ''}
            >
              <option value="">{t('All items')}</option>
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
            {t('Show report')}
          </button>
        </form>
        <div className="mt-space-3 flex flex-wrap gap-space-3">
          {EXPORTS.map(({ type, label }) => (
            <a
              className="min-h-12 rounded-sm text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
              href={`/api/housekeeping/export?${query}&type=${type}`}
              key={type}
            >
              {t(label)}
            </a>
          ))}
        </div>
        <p className="text-caption text-ink-muted">
          {t('CSV exports remain in English.')}
        </p>
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
                {t('{name}: used {quantity} {unit} in this date range', {
                  name: item.name,
                  quantity: formatQuantity(formatStockQuantity(usage)),
                  unit: item.unit_of_measure,
                })}
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
                  {row.item_name} · {t(TRANSACTION_LABELS[row.kind])} ·{' '}
                  {formatQuantity(row.quantity)} {row.unit_of_measure}
                </p>
                <p className="text-caption">
                  {formatLocalizedDate(
                    new Date(`${row.effective_date}T00:00:00Z`),
                    locale,
                    { dateStyle: 'medium', timeZone: 'UTC' },
                  )}{' '}
                  · {row.vendor ?? row.purpose ?? t('Receipt')}
                  {row.cost_paise !== null
                    ? ` · ${formatLocalizedCurrency(Number(row.cost_paise), locale)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-space-3 text-ink-muted">
            {t('No transactions match this date range.')}
          </p>
        )}
      </Card>
    </section>
  );
}
