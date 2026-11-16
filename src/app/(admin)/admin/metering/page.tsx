// Let administrators manage meters, rates, reading approvals, utility billing and usage reports.
import {
  METERING_PAGE_METADATA,
  MeteringAdminPage,
} from '@/components/metering/server-pages';
export const metadata = METERING_PAGE_METADATA;
export default function Page() {
  return <MeteringAdminPage />;
}
