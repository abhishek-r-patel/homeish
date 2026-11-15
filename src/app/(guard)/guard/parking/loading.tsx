// Keep parking navigation responsive without showing placeholder records.
import { ParkingRouteState } from '@/components/parking/shared';
export default function Loading() {
  return <ParkingRouteState kind="loading" />;
}
