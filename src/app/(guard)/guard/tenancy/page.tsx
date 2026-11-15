// Show guards the moving schedule without tenant selectors, identities or private files.
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
      audience="guard"
      baseHref="/guard/tenancy"
      searchParams={searchParams}
    />
  );
}
