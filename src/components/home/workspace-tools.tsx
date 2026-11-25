// Accessible P55 search and quick-create controls for the shared top bar.
'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { searchWorkspaceAction } from '../../app/workspace-actions';
import { Dialog } from '../ui/dialog';
import { EmptyState } from '../ui/feedback';
import { SearchInput } from '../ui/specialized-inputs';
import { useUiTranslator } from '../ui/language';
import type { WorkspaceSearchResult } from '../../core/home/workspace-discovery';
import type { ModuleKey } from '../../core/modules';
import type { ServerActionResult } from '../../core/actions/server-action';

export type WorkspaceQuickAction = {
  key: string;
  href: string;
  label: string;
  moduleKey: ModuleKey;
};

export function WorkspaceTools({
  createOpen,
  onCreateOpenChange,
  quickActions,
  searchAction = searchWorkspaceAction,
}: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  quickActions: readonly WorkspaceQuickAction[];
  searchAction?: (
    input: unknown,
  ) => Promise<ServerActionResult<WorkspaceSearchResult>>;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkspaceSearchResult | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function openSearch() {
    setSearchOpen(true);
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError(t('Enter at least 2 characters.'));
      return;
    }
    setError('');
    startTransition(async () => {
      const result = await searchAction(trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.data) setResults(result.data);
    });
  }

  const groups = results
    ? [
        { label: t('Pages'), items: results.pages },
        { label: t('Actions'), items: results.actions },
        {
          label: t('People'),
          items: results.records.filter((item) => item.kind === 'person'),
        },
        {
          label: t('Flats'),
          items: results.records.filter((item) => item.kind === 'flat'),
        },
        {
          label: t('Vehicles'),
          items: results.records.filter((item) => item.kind === 'vehicle'),
        },
      ]
    : [];

  return (
    <>
      <button
        aria-label={t('Search Homeish')}
        className="flex min-h-12 min-w-10 items-center justify-center gap-space-2 rounded-md border border-rule-strong bg-surface px-space-2 text-body text-ink-muted focus-visible:outline-2 focus-visible:outline-focus expanded:min-w-12 expanded:px-space-3"
        onClick={openSearch}
        type="button"
      >
        <span aria-hidden="true">⌕</span>
        <span className="hidden expanded:inline">{t('Search')}</span>
      </button>
      <button
        aria-label={t('Quick create')}
        aria-haspopup="dialog"
        className="hidden min-h-12 min-w-10 items-center justify-center rounded-md bg-brand px-space-2 text-title text-on-brand focus-visible:outline-2 focus-visible:outline-focus expanded:flex expanded:min-w-12 expanded:px-space-3"
        onClick={() => onCreateOpenChange(true)}
        type="button"
      >
        <span aria-hidden="true">+</span>
      </button>
      <Dialog
        className="!max-w-content-default"
        description={t(
          'Search pages and actions. People, flats and vehicles appear only when your role may open them.',
        )}
        id={`${id}-search-dialog`}
        onOpenChange={setSearchOpen}
        open={searchOpen}
        title={t('Search Homeish')}
      >
        <form className="grid gap-space-4" onSubmit={submit}>
          <SearchInput
            id={`${id}-search`}
            label={t('Pages, actions or records')}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onClear={() => {
              setQuery('');
              setResults(null);
            }}
            placeholder={t('Search by name, page or number')}
            value={query}
          />
          {error ? (
            <p className="text-caption text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {results ? (
            <div className="grid gap-space-5" aria-busy={pending}>
              {groups.some((group) => group.items.length) ? (
                groups.map((group) =>
                  group.items.length ? (
                    <section className="grid gap-space-2" key={group.label}>
                      <h3 className="text-micro font-semibold uppercase tracking-wide text-ink-muted">
                        {group.label}
                      </h3>
                      <ul className="grid gap-space-2">
                        {group.items.map((item) => (
                          <li
                            key={`${group.label}-${'record_id' in item ? item.record_id : item.href}`}
                          >
                            <Link
                              className="flex min-h-14 items-center justify-between gap-space-3 rounded-md border border-rule px-space-4 text-body-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
                              href={item.href}
                              onClick={() => setSearchOpen(false)}
                            >
                              <span className="grid gap-space-1">
                                <span>
                                  {'title' in item ? item.title : t(item.label)}
                                </span>
                                {'subtitle' in item ? (
                                  <span className="text-caption font-normal text-ink-muted">
                                    {item.subtitle}
                                  </span>
                                ) : null}
                              </span>
                              <span aria-hidden="true">→</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null,
                )
              ) : (
                <EmptyState
                  description={t('Try a shorter page, action or record name.')}
                  title={t('No results')}
                />
              )}
            </div>
          ) : null}
        </form>
      </Dialog>
      <Dialog
        description={t(
          'Every action shown here is available for your role and enabled modules.',
        )}
        id={`${id}-create-dialog`}
        onOpenChange={onCreateOpenChange}
        open={createOpen}
        title={t('Quick create')}
      >
        {quickActions.length ? (
          <ul className="grid gap-space-2">
            {quickActions.map((action) => (
              <li key={action.key}>
                <Link
                  className="flex min-h-14 items-center justify-between gap-space-3 rounded-md border border-rule px-space-4 text-body-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
                  href={action.href}
                  onClick={() => onCreateOpenChange(false)}
                >
                  <span>{t(action.label)}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            description={t(
              'No create actions are available for your current role and modules.',
            )}
            title={t('No quick-create actions')}
          />
        )}
      </Dialog>
    </>
  );
}
