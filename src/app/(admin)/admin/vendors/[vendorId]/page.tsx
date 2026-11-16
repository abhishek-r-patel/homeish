// Show one vendor with its documents, ratings and quotes.
import {
  VENDOR_PAGE_METADATA,
  VendorPage,
} from '@/components/vendor/server-pages';
export const metadata = VENDOR_PAGE_METADATA;
export default function Page({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  return <VendorPage params={params} />;
}
