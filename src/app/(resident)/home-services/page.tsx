// Show residents the society's listed home-service providers to browse, search and call.
import {
  HOME_SERVICES_PAGE_METADATA,
  HomeServicesDirectoryPage,
} from '@/components/home-services/server-pages';
export const metadata = HOME_SERVICES_PAGE_METADATA;
export default function Page() {
  return <HomeServicesDirectoryPage />;
}
