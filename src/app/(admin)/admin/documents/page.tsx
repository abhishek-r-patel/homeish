// Show admin document management or the committee's read-only view of every document.
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
      mode="management"
      baseHref="/admin/documents"
      searchParams={searchParams}
    />
  );
}
