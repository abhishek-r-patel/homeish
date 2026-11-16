// Show the vendor directory and purchase requests to the admin and committee.
import {
  VENDOR_PAGE_METADATA,
  VendorIndexPage,
} from '@/components/vendor/server-pages';
export const metadata = VENDOR_PAGE_METADATA;
export default function Page() {
  return <VendorIndexPage />;
}
