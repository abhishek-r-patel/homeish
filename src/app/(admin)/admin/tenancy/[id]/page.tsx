// Keep private administrative moving details unavailable to status-only committee access.
import {
  TENANCY_PAGE_METADATA,
  TenancyDetailPage,
} from '@/components/tenancy/server-pages';
export const metadata = TENANCY_PAGE_METADATA;
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <TenancyDetailPage
      audience="management"
      baseHref="/admin/tenancy"
      params={params}
    />
  );
}
