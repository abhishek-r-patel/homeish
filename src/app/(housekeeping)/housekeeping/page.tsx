// Load the permission-scoped inventory workspace for housekeeping supervisors.
import {
  InventoryWorkspace,
  type InventorySearch,
} from '@/components/housekeeping/workspace';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { createRequestId } from '@/core/errors';
import { getConfiguredQuickActions } from '@/core/home/workspace-operations';
import { getComingUp } from '@/core/home/dashboard-reads';
import {
  ComingUp,
  QuickActionTiles,
} from '@/components/home/dashboard-sections';
export const metadata = {
  title: 'Housekeeping inventory | Homeish',
  robots: { index: false, follow: false },
};
export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearch>;
}) {
  const context = await buildRequestContext(createRequestId());
  const [quickActions, comingUp, search] = await Promise.all([
    getConfiguredQuickActions(context, 'hk_supervisor'),
    getComingUp(context),
    searchParams,
  ]);
  return (
    <section className="grid gap-space-5">
      <header className="rounded-lg border border-brand/15 bg-brand-tint p-space-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-brand">
          Housekeeping
        </p>
        <h1 className="text-heading font-semibold">Today’s work</h1>
      </header>
      <QuickActionTiles actions={quickActions} firstFourOnPhone />
      <ComingUp items={comingUp} timezone="Asia/Kolkata" />
      <InventoryWorkspace search={search} />
    </section>
  );
}
