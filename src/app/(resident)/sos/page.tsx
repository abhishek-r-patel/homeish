// Raise an SOS for the resident's unit, follow its status and call emergency contacts.
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
      audience="resident"
      baseHref="/sos"
      searchParams={searchParams}
    />
  );
}
