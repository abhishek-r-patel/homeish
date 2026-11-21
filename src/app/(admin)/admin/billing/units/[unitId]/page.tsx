// Admin view of one unit's running billing ledger.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LedgerTable } from '@/components/billing/tables';
import { TenantMoveInForm } from '@/components/billing/tenant-move-in';
import { Card } from '@/components/ui/data-display';
import { isUuid, todayInTimeZone } from '@/core/billing/format';
import {
  getBillingAdminContext,
  getBillingLedger,
  listBillingUnits,
  listUnconfirmedTenantMoves,
} from '@/core/billing/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Unit ledger | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminUnitLedgerPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const { unitId } = await params;
  if (!isUuid(unitId)) notFound();
  const [admin, entries, units] = await Promise.all([
    getBillingAdminContext(),
    getBillingLedger(unitId),
    listBillingUnits(),
  ]);
  const unit = units.find((item) => item.id === unitId);
  const name = `${admin.unitLabel} ${unit?.number ?? ''}`.trim();
  const pendingMoves = admin.canManage
    ? await listUnconfirmedTenantMoves(unitId)
    : [];
  const today = todayInTimeZone(admin.timezone);
  return (
    <section className="grid gap-space-5">
      <Link className="text-body text-brand underline" href="/admin/billing">
        ← {t('Billing')}
      </Link>
      <header className="grid gap-space-1">
        <h1 className="text-title font-semibold">
          {name} {t('ledger')}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            'Every bill, payment, waiver and adjustment with the running balance.',
          )}
        </p>
      </header>
      {pendingMoves.length ? (
        <Card
          title={t('Tenant move-in dates')}
          description={t(
            'Confirm the day the tenant actually moved in. This changes future bill calculations, not published bills or resident access.',
          )}
        >
          {pendingMoves.map((move) => (
            <TenantMoveInForm
              key={move.id}
              id={move.id}
              name={move.name}
              maxDate={move.ended_on ?? today}
            />
          ))}
        </Card>
      ) : null}
      <Card title={t('Ledger')}>
        <LedgerTable
          caption={t('{name} ledger', { name })}
          entries={entries}
          timeZone={admin.timezone}
        />
      </Card>
    </section>
  );
}
