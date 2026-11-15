// Show administrator parking controls or the committee's read-only view.
import {
  PARKING_PAGE_METADATA,
  ParkingAdminPage,
} from '@/components/parking/server-pages';
export const metadata = PARKING_PAGE_METADATA;
export default function Page() {
  return <ParkingAdminPage />;
}
