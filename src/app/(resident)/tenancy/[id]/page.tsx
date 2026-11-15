// Show one move only after private tenant or active-owner authorisation.
import {
  TENANCY_PAGE_METADATA,
  TenancyDetailPage,
} from '@/components/tenancy/server-pages';
export const metadata = TENANCY_PAGE_METADATA;
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <TenancyDetailPage
      audience="resident"
      baseHref="/tenancy"
      params={params}
    />
  );
}
