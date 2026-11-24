// Load the inventory workspace for administrators and read-only committee members.
import {
  InventoryWorkspace,
  type InventorySearch,
} from '@/components/housekeeping/workspace';
import { FeatureTabs } from '@/components/home/feature-tabs';
import { getFeatureTabs } from '@/core/home/feature-tabs';
export const metadata = {
  title: 'Housekeeping inventory | Homeish',
  robots: { index: false, follow: false },
};
export default async function AdminHousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearch>;
}) {
  const [search, featureTabs] = await Promise.all([
    searchParams,
    getFeatureTabs('upkeep'),
  ]);
  return (
    <div className="grid gap-space-5">
      <FeatureTabs items={featureTabs} />
      <InventoryWorkspace search={search} />
    </div>
  );
}
