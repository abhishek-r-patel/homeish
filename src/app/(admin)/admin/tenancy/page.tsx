// Show administrator moving controls or the committee's status-only schedule.
import {
  TENANCY_PAGE_METADATA,
  TenancyIndexPage,
  type TenancyPageSearch,
} from '@/components/tenancy/server-pages';
export const metadata = TENANCY_PAGE_METADATA;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<TenancyPageSearch>;
}) {
  return (
    <TenancyIndexPage
      audience="management"
      baseHref="/admin/tenancy"
      searchParams={searchParams}
    />
  );
}
