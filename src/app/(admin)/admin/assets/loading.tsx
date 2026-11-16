// Keep asset register navigation responsive without showing placeholder records.
import { AssetRouteState } from '@/components/asset/shared';
export default function Loading() {
  return <AssetRouteState kind="loading" />;
}
