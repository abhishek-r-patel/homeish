// Keep patrol navigation responsive without showing placeholder records.
import { PatrolRouteState } from '@/components/patrol/shared';
export default function Loading() {
  return <PatrolRouteState kind="loading" />;
}
