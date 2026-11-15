// Let guards raise an SOS from the gate and respond to open alerts.
import {
  SOS_PAGE_METADATA,
  SosIndexPage,
  type SosPageSearch,
} from '@/components/sos/server-pages';
export const metadata = SOS_PAGE_METADATA;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<SosPageSearch>;
}) {
  return (
    <SosIndexPage
      audience="guard"
      baseHref="/guard/sos"
      searchParams={searchParams}
    />
  );
}
