// Keep communication dashboard navigation responsive without showing placeholder figures.
import { ToolkitRouteState } from '@/components/toolkit/shared';
export default function Loading() {
  return <ToolkitRouteState kind="loading" title="Communication" />;
}
