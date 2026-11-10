// Admin view of one unit's running billing ledger.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LedgerTable } from '@/components/billing/tables';
import { Card } from '@/components/ui/data-display';
import { isUuid } from '@/core/billing/format';
import {
  getBillingAdminContext,
  getBillingLedger,
  listBillingUnits,
} from '@/core/billing/operations';

export const metadata = {
  title: 'Unit ledger | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminUnitLedgerPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  if (!isUuid(unitId)) notFound();
  const [admin, entries, units] = await Promise.all([
    getBillingAdminContext(),
    getBillingLedger(unitId),
    listBillingUnits(),
  ]);
  const unit = units.find((item) => item.id === unitId);
  const name = `${admin.unitLabel} ${unit?.number ?? ''}`.trim();
  return (
    <section className="grid gap-space-5">
      <Link className="text-body text-brand underline" href="/admin/billing">
        ← Billing
      </Link>
      <header className="grid gap-space-1">
        <h1 className="text-title font-semibold">{name} ledger</h1>
        <p className="text-body text-ink-muted">
          Every bill, payment, waiver and adjustment with the running balance.
        </p>
      </header>
      <Card title="Ledger">
        <LedgerTable
          caption={`${name} ledger`}
          entries={entries}
          timeZone={admin.timezone}
        />
      </Card>
    </section>
  );
}
