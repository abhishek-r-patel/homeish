// Let guards find a meter and record its reading.
import {
  METERING_PAGE_METADATA,
  MeteringGuardPage,
  type MeteringPageSearch,
} from '@/components/metering/server-pages';
export const metadata = METERING_PAGE_METADATA;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<MeteringPageSearch>;
}) {
  return <MeteringGuardPage searchParams={searchParams} />;
}
