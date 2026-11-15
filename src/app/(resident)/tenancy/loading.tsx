// Keep resident moving navigation responsive without showing placeholder records or balances.
import { TenancyRouteState } from '@/components/tenancy/workspace';
export default function Loading() {
  return <TenancyRouteState kind="loading" />;
}
