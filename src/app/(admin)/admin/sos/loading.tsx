// Keep emergency navigation responsive without placeholder alerts.
import { SosRouteState } from '@/components/sos/workspace';
export default function Loading() {
  return <SosRouteState kind="loading" />;
}
