// Browse only the resident details returned by the permission-checked directory.
'use client';

import { useRef, useState, useTransition } from 'react';
import { getDirectoryResidentsPageAction } from '../../app/directory/actions';
import type {
  DirectoryPage,
  DirectoryResident,
} from '../../core/directory/validation';
import { Button } from '../ui/button';
import { EmptyState, ErrorPanel } from '../ui/feedback';
import { SearchInput } from '../ui/specialized-inputs';
import { Pagination, type PageSize } from '../ui/table-controls';
import { useUiTranslator } from '../ui/language';
import { formatLocalizedNumber } from '../../core/i18n/format';

export type DirectoryPageRequest = {
  search: string;
  limit: number;
  offset: number;
};

export type DirectoryPageLoadResult =
  | { ok: true; data?: DirectoryPage<DirectoryResident> }
  | { ok: false; message: string; referenceId?: string };

export type DirectoryPageLoader = (
  input: DirectoryPageRequest,
) => Promise<DirectoryPageLoadResult>;

export function ResidentDirectory({
  loadResidents = getDirectoryResidentsPageAction,
  residents,
}: {
  loadResidents?: DirectoryPageLoader;
  residents: DirectoryPage<DirectoryResident>;
}) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [pageData, setPageData] = useState(residents);
  const [failure, setFailure] = useState<{
    message: string;
    referenceId?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestVersion = useRef(0);

  function loadPage(
    nextPage: number,
    nextPageSize = pageSize,
    nextSearch = search,
  ) {
    const version = ++requestVersion.current;
    startTransition(async () => {
      const result = await loadResidents({
        search: nextSearch,
        limit: nextPageSize,
        offset: (nextPage - 1) * nextPageSize,
      });
      if (version !== requestVersion.current) return;
      if (!result.ok) {
        setPageData({
          items: [],
          total: 0,
          limit: nextPageSize,
          offset: (nextPage - 1) * nextPageSize,
        });
        setFailure({
          message: result.message,
          ...(result.referenceId ? { referenceId: result.referenceId } : {}),
        });
        return;
      }
      if (!result.data) {
        setPageData({
          items: [],
          total: 0,
          limit: nextPageSize,
          offset: (nextPage - 1) * nextPageSize,
        });
        setFailure({ message: 'The directory returned an invalid response.' });
        return;
      }
      setFailure(null);
      setPageData(result.data);
      setPage(nextPage);
      setPageSize(nextPageSize);
      setSearch(nextSearch);
    });
  }

  const pageResidents = pageData.items.map((resident, index) => ({
    ...resident,
    entryKey: `${resident.membership_id}-${index}`,
  }));
  const totalPages = Math.max(1, Math.ceil(pageData.total / pageSize));

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Resident directory')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Find your neighbours by name or unit. Only details you are permitted to view appear here.',
          )}
        </p>
      </header>

      {failure ? (
        <ErrorPanel
          message={translateFeedback(failure.message)}
          referenceId={failure.referenceId}
          title={t('Could not load directory results')}
        />
      ) : null}
      <fieldset className="grid min-w-0 gap-space-5">
        <form
          className="flex flex-col items-end gap-space-2 medium:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const nextSearch = query.trim();
            loadPage(1, pageSize, nextSearch);
          }}
        >
          <div className="w-full flex-1">
            <SearchInput
              helpText={t('Searches only the names and units visible to you.')}
              id="directory-search"
              label={t('Search by name or unit')}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onClear={() => {
                setQuery('');
                loadPage(1, pageSize, '');
              }}
              placeholder={t('Name or unit number')}
              value={query}
            />
          </div>
          <Button disabled={isPending} loading={isPending} type="submit">
            {t('Search')}
          </Button>
        </form>
        {!failure ? (
          <>
            <p
              aria-atomic="true"
              aria-live="polite"
              className="text-caption text-ink-muted"
              role="status"
            >
              {t(
                search
                  ? pageData.total === 1
                    ? '{count} directory entry matching your search'
                    : '{count} directory entries matching your search'
                  : pageData.total === 1
                    ? '{count} directory entry available'
                    : '{count} directory entries available',
                {
                  count: formatLocalizedNumber(pageData.total, locale ?? 'en'),
                },
              )}
            </p>
            {pageData.total === 0 ? (
              <EmptyState
                description={t(
                  search
                    ? 'Try a different name or unit number, or clear your search.'
                    : 'No resident entries are available to your account yet.',
                )}
                title={t(
                  search ? 'No matching residents' : 'No residents to show',
                )}
              />
            ) : (
              <>
                <ul
                  aria-label={t('Residents')}
                  className="grid min-w-0 gap-space-3 medium:grid-cols-2"
                >
                  {pageResidents.map((resident) => (
                    <li
                      className="grid min-w-0 content-start gap-space-3 rounded-md border border-rule bg-surface p-space-4"
                      key={resident.entryKey}
                    >
                      <h2 className="break-words text-heading font-semibold">
                        {resident.full_name || t('Resident')}
                      </h2>
                      <dl className="grid min-w-0 gap-space-3">
                        <div className="grid min-w-0 gap-space-1">
                          <dt className="text-caption text-ink-muted">
                            {t('Unit')}
                          </dt>
                          <dd className="break-words text-body">
                            {resident.unit_number ?? t('Not shared')}
                          </dd>
                        </div>
                        <div className="grid min-w-0 gap-space-1">
                          <dt className="text-caption text-ink-muted">
                            {t('Phone')}
                          </dt>
                          <dd className="min-w-0 break-words text-body">
                            {resident.phone ? (
                              <a
                                aria-label={t('Call {name} on {phone}', {
                                  name: resident.full_name || t('Resident'),
                                  phone: resident.phone,
                                })}
                                className="inline-flex min-h-12 max-w-full items-center rounded-sm text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                                href={`tel:${resident.phone}`}
                              >
                                {resident.phone}
                              </a>
                            ) : (
                              <span className="text-ink-muted">
                                {t('Not shared')}
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
                {pageData.total > 10 ? (
                  <fieldset disabled={isPending}>
                    <Pagination
                      onPageChange={(nextPage) =>
                        loadPage(nextPage, pageSize, search)
                      }
                      onPageSizeChange={(size) => {
                        loadPage(1, size, search);
                      }}
                      page={Math.min(page, totalPages)}
                      pageSize={pageSize}
                      total={pageData.total}
                    />
                  </fieldset>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </fieldset>
    </section>
  );
}
