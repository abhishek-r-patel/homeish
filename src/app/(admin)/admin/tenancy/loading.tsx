// Show an accessible loading state while the administrative moving workspace is authorised.
import { TenancyRouteState } from '@/components/tenancy/workspace';
export default function Loading() {
  return <TenancyRouteState kind="loading" />;
}
