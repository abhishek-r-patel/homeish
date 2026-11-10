// Preserve non-personal filters while paging developer console lists.
'use client';

import { useRouter } from 'next/navigation';
import { Pagination } from '@/components/ui/table-controls';
import type { PageSize } from '@/components/ui/table-controls';

export function QueryPagination({
  href,
  page,
  pageSize,
  total,
  filters,
}: {
  href: string;
  page: number;
  pageSize: PageSize;
  total: number;
  filters: Readonly<Record<string, string>>;
}) {
  const router = useRouter();

  function navigate(nextPage: number, nextPageSize: PageSize) {
    const query = new URLSearchParams(filters);
    query.set('page', String(nextPage));
    query.set('pageSize', String(nextPageSize));
    router.push(`${href}?${query.toString()}`);
  }

  return (
    <Pagination
      onPageChange={(nextPage) => navigate(nextPage, pageSize)}
      onPageSizeChange={(nextPageSize) => navigate(1, nextPageSize)}
      page={page}
      pageSize={pageSize}
      total={total}
    />
  );
}
