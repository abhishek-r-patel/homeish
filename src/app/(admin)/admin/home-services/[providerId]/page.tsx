// Show one provider to administrators and committee, including hidden comments and moderation.
import {
  HOME_SERVICES_PAGE_METADATA,
  HomeServicesProviderPage,
} from '@/components/home-services/server-pages';
export const metadata = HOME_SERVICES_PAGE_METADATA;
export default function Page({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  return <HomeServicesProviderPage params={params} admin />;
}
