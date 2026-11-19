// Keep adoption tracker navigation responsive without showing placeholder records.
import { ToolkitRouteState } from '@/components/toolkit/shared';
export default function Loading() {
  return <ToolkitRouteState kind="loading" title="Adoption tracker" />;
}
