// Show administrators SOS response, history, recipients and contacts; committee members view and respond.
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
      audience="management"
      baseHref="/admin/sos"
      searchParams={searchParams}
    />
  );
}
