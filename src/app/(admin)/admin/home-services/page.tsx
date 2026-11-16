// Show administrator home-services curation or the committee's view-and-suggest workspace.
import {
  HOME_SERVICES_PAGE_METADATA,
  HomeServicesAdminPage,
} from '@/components/home-services/server-pages';
export const metadata = HOME_SERVICES_PAGE_METADATA;
export default function Page() {
  return <HomeServicesAdminPage />;
}
