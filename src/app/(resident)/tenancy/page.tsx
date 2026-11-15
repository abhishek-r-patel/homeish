// Show a resident's own moving requests and actively owned household contexts.
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
      audience="resident"
      baseHref="/tenancy"
      searchParams={searchParams}
    />
  );
}
