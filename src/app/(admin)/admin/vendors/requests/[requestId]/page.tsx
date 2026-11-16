// Show one purchase request with its quotes, approvals and actions.
import {
  PurchaseRequestPage,
  VENDOR_PAGE_METADATA,
} from '@/components/vendor/server-pages';
export const metadata = VENDOR_PAGE_METADATA;
export default function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  return <PurchaseRequestPage params={params} />;
}
