// Load the inventory workspace for administrators and read-only committee members.
import {
  InventoryWorkspace,
  type InventorySearch,
} from '@/components/housekeeping/workspace';
export const metadata = {
  title: 'Housekeeping inventory | Homeish',
  robots: { index: false, follow: false },
};
export default async function AdminHousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearch>;
}) {
  return <InventoryWorkspace search={await searchParams} />;
}
