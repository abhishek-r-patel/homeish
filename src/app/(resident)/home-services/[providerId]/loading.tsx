// Keep home-services navigation responsive without showing placeholder records.
import { HomeServicesRouteState } from '@/components/home-services/shared';
export default function Loading() {
  return <HomeServicesRouteState kind="loading" />;
}
