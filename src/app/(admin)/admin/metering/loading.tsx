// Keep metering navigation responsive without showing placeholder records.
import { MeteringRouteState } from '@/components/metering/shared';
export default function Loading() {
  return <MeteringRouteState kind="loading" />;
}
