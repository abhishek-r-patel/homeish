// Keep the guard schedule responsive without exposing private loading placeholders.
import { TenancyRouteState } from '@/components/tenancy/workspace';
export default function Loading() {
  return <TenancyRouteState kind="loading" />;
}
