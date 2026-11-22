// Show one authorized transfer case without adding a module or navigation entry.
import { TenancyTransferDetailPage } from '@/components/tenancy/transfer-pages';
import { TENANCY_PAGE_METADATA } from '@/components/tenancy/server-pages';
export const metadata = TENANCY_PAGE_METADATA;

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TenancyTransferDetailPage params={params} />;
}
