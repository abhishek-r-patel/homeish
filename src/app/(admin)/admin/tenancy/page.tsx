// Show administrator moving controls or the committee's status-only schedule.
import {
  TENANCY_PAGE_METADATA,
  TenancyIndexPage,
  type TenancyPageSearch,
} from '@/components/tenancy/server-pages';
import { TenancyTransferIndexPage } from '@/components/tenancy/transfer-pages';
import { TenancyAdminTabs } from '@/components/tenancy/transfer-workspace';
export const metadata = TENANCY_PAGE_METADATA;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<TenancyPageSearch>;
}) {
  const query = await searchParams;
  if (query.tab === 'transfers') {
    return <TenancyTransferIndexPage searchParams={searchParams} />;
  }
  const moveSearch = { ...query };
  delete moveSearch.tab;
  return (
    <>
      <TenancyAdminTabs selected="moves" />
      <TenancyIndexPage
        audience="management"
        baseHref="/admin/tenancy"
        searchParams={Promise.resolve(moveSearch)}
      />
    </>
  );
}
