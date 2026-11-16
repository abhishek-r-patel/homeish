// Keep vendor navigation responsive without showing placeholder records.
import { VendorRouteState } from '@/components/vendor/shared';
export default function Loading() {
  return <VendorRouteState kind="loading" />;
}
