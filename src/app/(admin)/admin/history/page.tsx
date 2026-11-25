// Show allow-listed, redacted change history for the active society.
import { Card } from '@/components/ui/data-display';
import { AuditHistoryList } from '@/components/audit/history-list';
import { getAuditHistory, getAuditHistoryAccess } from '@/core/audit/history';
import { undoAuditSettingAction } from './actions';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Change history | Homeish',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function dateBoundary(value: string | string[] | undefined, end = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}+05:30`;
}

export default async function ChangeHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : '';
  const access = await getAuditHistoryAccess();
  const rows = await getAuditHistory({
    from: dateBoundary(params.from),
    before: dateBoundary(params.before, true),
    category: category || null,
  });
  const categories = [...new Set(rows.map((row) => row.category))].sort();

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Change history')}</h1>
        <p className="max-w-prose text-body text-ink-muted">
          {t(
            'Review society changes. Private values are hidden; only reversible settings may show Undo.',
          )}
        </p>
      </header>
      <Card title={t('Filters')}>
        <form className="grid gap-space-3 medium:grid-cols-3" method="get">
          <label className="grid gap-space-1 text-body-strong">
            {t('From')}
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
              defaultValue={
                typeof params.from === 'string' ? params.from : undefined
              }
              name="from"
              type="date"
            />
          </label>
          <label className="grid gap-space-1 text-body-strong">
            {t('Before')}
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
              defaultValue={
                typeof params.before === 'string' ? params.before : undefined
              }
              name="before"
              type="date"
            />
          </label>
          <label className="grid gap-space-1 text-body-strong">
            {t('Category')}
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
              defaultValue={category}
              name="category"
            >
              <option value="">{t('All categories')}</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-12 justify-self-start rounded-md border border-brand bg-brand px-space-4 font-semibold text-on-brand"
            type="submit"
          >
            {t('Apply filters')}
          </button>
        </form>
      </Card>
      <Card title={t('{count} recent changes', { count: rows.length })}>
        <AuditHistoryList
          rows={
            access.isAdmin
              ? rows
              : rows.map((row) => ({ ...row, canUndo: false }))
          }
          undoAction={undoAuditSettingAction}
        />
      </Card>
    </section>
  );
}
