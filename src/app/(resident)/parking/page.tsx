// Show a resident's parking slots, waitlist requests, visitor passes and reports.
import {
  PARKING_PAGE_METADATA,
  ParkingResidentPage,
} from '@/components/parking/server-pages';
export const metadata = PARKING_PAGE_METADATA;
export default function Page() {
  return <ParkingResidentPage />;
}
