// Let residents see their unit meters and send readings with a photo.
import {
  METERING_PAGE_METADATA,
  MeteringResidentPage,
} from '@/components/metering/server-pages';
export const metadata = METERING_PAGE_METADATA;
export default function Page() {
  return <MeteringResidentPage />;
}
