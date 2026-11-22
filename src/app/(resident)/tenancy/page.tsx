// Show a resident's own moving requests and actively owned household contexts.
import {
  TENANCY_PAGE_METADATA,
  TenancyIndexPage,
  type TenancyPageSearch,
} from '@/components/tenancy/server-pages';
import { TenancyTransferIndexPage } from '@/components/tenancy/transfer-pages';
export const metadata = TENANCY_PAGE_METADATA;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<TenancyPageSearch>;
}) {
  const query = await searchParams;
  const moveSearch = { ...query };
  delete moveSearch.transferId;
  return (
    <>
      <TenancyIndexPage
        audience="resident"
        baseHref="/tenancy"
        searchParams={Promise.resolve(moveSearch)}
      />
      <TenancyTransferIndexPage
        resident
        searchParams={Promise.resolve(query)}
      />
    </>
  );
}
