// Show society folders and unit documents the signed-in resident is allowed to view.
import {
  DOCUMENT_PAGE_METADATA,
  DocumentIndexPage,
  type DocumentPageSearch,
} from '@/components/document/server-pages';
export const metadata = DOCUMENT_PAGE_METADATA;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<DocumentPageSearch>;
}) {
  return (
    <DocumentIndexPage
      mode="resident"
      baseHref="/documents"
      searchParams={searchParams}
    />
  );
}
