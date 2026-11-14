// Load the permission-scoped inventory workspace for housekeeping supervisors.
import {
  InventoryWorkspace,
  type InventorySearch,
} from '@/components/housekeeping/workspace';
export const metadata = {
  title: 'Housekeeping inventory | Homeish',
  robots: { index: false, follow: false },
};
export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearch>;
}) {
  return <InventoryWorkspace search={await searchParams} />;
}
