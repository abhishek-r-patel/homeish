// Searchable, filterable help articles and the getting-started path for the viewer's roles.
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { SelectInput } from '@/components/ui/select-input';
import { SearchInput } from '@/components/ui/specialized-inputs';
import {
  filterHelpArticles,
  type HelpFilters,
  type HelpView,
} from '@/core/help/filter';

const EMPTY_FILTERS: HelpFilters = {
  query: '',
  category: '',
  role: '',
  module: '',
  level: '',
};

export function HelpBrowser({ view }: { view: HelpView }) {
  const { translate: t } = useUiTranslator();
  const [filters, setFilters] = useState<HelpFilters>(EMPTY_FILTERS);
  const results = useMemo(
    () => filterHelpArticles(view.articles, filters),
    [view.articles, filters],
  );
  const filtered = Object.values(filters).some(Boolean);
  const pick = <K extends keyof HelpFilters>(
    key: K,
    options: readonly { value: string }[],
    value: string,
  ) => {
    const match = options.find((option) => option.value === value);
    setFilters((current) => ({
      ...current,
      [key]: (match?.value ?? '') as HelpFilters[K],
    }));
  };
  const allOption = { value: '', label: t('All') };

  return (
    <div className="grid min-w-0 gap-space-5">
      {view.gettingStarted.map((path) => (
        <Card
          key={path.role}
          title={t('Getting started: {role}', { role: path.roleLabel })}
        >
          <ol className="grid min-w-0 gap-space-3">
            {path.steps.map((step, index) => (
              <li
                className="grid min-w-0 gap-space-1"
                key={`${path.role}-${step.stage}`}
              >
                <p className="text-body-strong">
                  {index + 1}. {step.stageLabel}
                </p>
                <p>{step.text}</p>
                {step.links.length ? (
                  <p className="flex flex-wrap gap-space-3">
                    {step.links.map((link) => (
                      <Link
                        className="text-brand underline"
                        href={link.href}
                        key={link.href}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      ))}

      <section
        aria-label={t('Help articles')}
        className="grid min-w-0 gap-space-4"
      >
        <SearchInput
          id="help-search"
          label={t('Search help')}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              query: event.target.value,
            }))
          }
          onClear={() => setFilters((current) => ({ ...current, query: '' }))}
          value={filters.query}
        />
        <div className="grid min-w-0 gap-space-3 medium:grid-cols-2 expanded:grid-cols-4">
          <SelectInput
            id="help-category"
            label={t('Category')}
            onChange={(event) =>
              pick('category', view.categories, event.target.value)
            }
            options={[allOption, ...view.categories]}
            value={filters.category}
          />
          <SelectInput
            id="help-role"
            label={t('Role')}
            onChange={(event) => pick('role', view.roles, event.target.value)}
            options={[allOption, ...view.roles]}
            value={filters.role}
          />
          <SelectInput
            id="help-module"
            label={t('Module')}
            onChange={(event) =>
              pick('module', view.modules, event.target.value)
            }
            options={[allOption, ...view.modules]}
            value={filters.module}
          />
          <SelectInput
            id="help-level"
            label={t('Level')}
            onChange={(event) => pick('level', view.levels, event.target.value)}
            options={[allOption, ...view.levels]}
            value={filters.level}
          />
        </div>
        <p aria-live="polite" className="text-caption text-ink-muted">
          {t('{count} of {total} articles', {
            count: results.length,
            total: view.articles.length,
          })}
        </p>
        {results.length ? (
          <ul className="grid min-w-0 gap-space-3">
            {results.map((article) => (
              <li key={article.id}>
                <article className="grid min-w-0 gap-space-2 rounded-md border border-rule bg-surface p-space-4">
                  <h2 className="text-subheading">{article.title}</h2>
                  <p className="text-caption text-ink-muted">
                    {[
                      article.categoryLabel,
                      article.levelLabel,
                      ...article.moduleLabels,
                    ].join(' · ')}
                  </p>
                  <p>{article.answer}</p>
                  {article.links.length ? (
                    <p className="flex flex-wrap gap-space-3">
                      {article.links.map((link) => (
                        <Link
                          className="text-brand underline"
                          href={link.href}
                          key={link.href}
                        >
                          {t('Open {screen}', { screen: link.label })}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            action={
              filtered ? (
                <Button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  variant="secondary"
                >
                  {t('Clear filters')}
                </Button>
              ) : undefined
            }
            description={
              filtered
                ? t('Try other words or clear the filters.')
                : t('Help for the screens your society uses appears here.')
            }
            title={
              filtered ? t('No matching articles') : t('No help articles yet')
            }
          />
        )}
      </section>
    </div>
  );
}
