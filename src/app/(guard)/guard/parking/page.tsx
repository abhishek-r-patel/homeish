// Let guards check visitor passes, look up slot holders and report wrong parking.
import {
  PARKING_PAGE_METADATA,
  ParkingGuardPage,
  type ParkingPageSearch,
} from '@/components/parking/server-pages';
export const metadata = PARKING_PAGE_METADATA;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<ParkingPageSearch>;
}) {
  return <ParkingGuardPage searchParams={searchParams} />;
}
