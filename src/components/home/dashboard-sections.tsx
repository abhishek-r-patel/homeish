// Render shared P54 quick actions, Coming up rows and six-month graphs.
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveResidentGraphModeAction } from '@/app/(resident)/home/actions';
import { ModuleIcon } from '@/components/app-shells';
import { EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import type { ModuleKey } from '@/core/modules';
import type {
  ComingUpItem,
  ResidentDashboardGraph,
} from '@/core/home/dashboard-reads';
import {
  formatLocalizedCurrency,
  formatLocalizedDateTime,
} from '@/core/i18n/format';

type QuickAction = {
  key: string;
  href: string;
  label: string;
  moduleKey: ModuleKey;
};

const SOURCE_LABELS: Readonly<Record<ComingUpItem['source'], string>> = {
  meeting: 'Meeting',
  event: 'Event',
  bill: 'Bill due',
  amenity: 'Amenity booking',
  amc: 'AMC renewal',
  poll: 'Poll closes',
};

export function QuickActionTiles({
  actions,
  firstFourOnPhone = false,
}: {
  actions: readonly QuickAction[];
  firstFourOnPhone?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <section className="grid gap-space-3" aria-labelledby="quick-actions-title">
      <h2 className="text-heading" id="quick-actions-title">
        {t('Quick actions')}
      </h2>
      {actions.length ? (
        <ul className="grid grid-cols-2 gap-space-3 medium:grid-cols-3 expanded:grid-cols-4">
          {actions.map((action, index) => (
            <li
              className={
                firstFourOnPhone && index >= 4 ? 'hidden medium:block' : ''
              }
              key={action.key}
            >
              <Link
                className="flex min-h-24 flex-col items-start justify-between gap-space-3 rounded-md border border-rule bg-surface p-space-4 text-body-strong shadow-card hover:border-brand hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href={action.href}
              >
                <ModuleIcon moduleKey={action.moduleKey} />
                <span>{t(action.label)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          description={t(
            'Actions become available when their module and permission are available.',
          )}
          title={t('No quick actions available')}
        />
      )}
    </section>
  );
}

export function ComingUp({
  items,
  timezone,
}: {
  items: readonly ComingUpItem[];
  timezone: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <section className="grid gap-space-3" aria-labelledby="coming-up-title">
      <div className="flex items-end justify-between gap-space-3">
        <h2 className="text-heading" id="coming-up-title">
          {t('Coming up')}
        </h2>
        <span className="text-caption text-ink-muted">{t('Next 7 days')}</span>
      </div>
      {items.length ? (
        <ul className="overflow-hidden rounded-md border border-rule bg-surface">
          {items.map((item) => (
            <li
              className="border-b border-rule last:border-b-0"
              key={`${item.source}-${item.item_id}`}
            >
              <Link
                className="flex min-h-14 items-center justify-between gap-space-3 p-space-4 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus"
                href={item.href}
              >
                <span className="grid min-w-0 gap-space-1">
                  <span className="text-caption text-brand">
                    {t(SOURCE_LABELS[item.source])}
                  </span>
                  <span className="break-words text-body-strong">
                    {item.title}
                  </span>
                </span>
                <time
                  className="shrink-0 text-caption text-ink-muted"
                  dateTime={item.occurs_at}
                >
                  {formatLocalizedDateTime(
                    new Date(item.occurs_at),
                    locale ?? 'en',
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: timezone,
                    },
                  )}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          description={t('Nothing scheduled in the next seven days.')}
          title={t('Your week is clear')}
        />
      )}
    </section>
  );
}

type GraphPoint = { month_start: string; amount: number };

export function CollectionGraph({
  points,
}: {
  points: readonly { month: string; collected_paise: string }[];
}) {
  const { locale, translate: t } = useUiTranslator();
  const graphPoints = points.map((point) => ({
    month_start: point.month,
    amount: Number(BigInt(point.collected_paise)) / 100,
  }));
  const total = graphPoints.reduce((sum, point) => sum + point.amount, 0);
  return (
    <GraphCard
      description={t('Maintenance collected over the last six months.')}
      points={graphPoints}
      summary={t('{amount} collected in six months', {
        amount: formatLocalizedCurrency(
          BigInt(Math.round(total * 100)),
          locale ?? 'en',
        ),
      })}
      title={t('Collection')}
    />
  );
}

export function ResidentGraph({ graph }: { graph: ResidentDashboardGraph }) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  const [mode, setMode] = useState<'water' | 'bills' | null>(
    graph.mode === 'water' || graph.mode === 'bills' ? graph.mode : null,
  );
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  if (!graph.mode || !mode) return null;
  const rows = mode === 'water' ? graph.water : graph.bills;
  if (!rows) return null;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const canSwitch = Boolean(graph.water && graph.bills);
  const summary =
    mode === 'water'
      ? t('Water use total {amount}', {
          amount: new Intl.NumberFormat(locale ?? 'en', {
            maximumFractionDigits: 2,
          }).format(total),
        })
      : t('Bills total {amount}', {
          amount: formatLocalizedCurrency(
            BigInt(Math.round(total * 100)),
            locale ?? 'en',
          ),
        });

  function changeMode(nextMode: 'water' | 'bills') {
    if (!graph.mode || nextMode === mode) return;
    setError('');
    startTransition(async () => {
      const result = await saveResidentGraphModeAction(nextMode);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMode(nextMode);
    });
  }

  return (
    <div className="grid gap-space-2">
      {canSwitch ? (
        <div className="flex gap-space-2" aria-label={t('Graph type')}>
          <button
            aria-pressed={mode === 'water'}
            className="min-h-10 rounded-md border border-rule bg-surface px-space-3 text-body-strong"
            disabled={pending}
            onClick={() => changeMode('water')}
            type="button"
          >
            {t('Water use')}
          </button>
          <button
            aria-pressed={mode === 'bills'}
            className="min-h-10 rounded-md border border-rule bg-surface px-space-3 text-body-strong"
            disabled={pending}
            onClick={() => changeMode('bills')}
            type="button"
          >
            {t('Bills')}
          </button>
        </div>
      ) : null}
      <GraphCard
        description={t(
          mode === 'water'
            ? 'Water use for your home over the last six months.'
            : 'Bills for your home over the last six months.',
        )}
        points={rows}
        summary={summary}
        title={mode === 'water' ? t('Water use') : t('My bills')}
      />
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {translateFeedback(error)}
        </p>
      ) : null}
    </div>
  );
}

function GraphCard({
  description,
  points,
  summary,
  title,
}: {
  description: string;
  points: readonly GraphPoint[];
  summary: string;
  title: string;
}) {
  const maximum = Math.max(...points.map((point) => point.amount), 0);
  return (
    <section className="grid gap-space-4 rounded-md border border-rule bg-surface p-space-5 shadow-card">
      <div className="grid gap-space-1">
        <h2 className="text-heading">{title}</h2>
        <p className="text-caption text-ink-muted">{description}</p>
      </div>
      <div
        aria-label={summary}
        className="flex h-36 items-end gap-space-2"
        role="img"
      >
        {points.map((point) => (
          <div
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-space-1"
            key={point.month_start}
          >
            <span
              aria-hidden="true"
              className="w-full max-w-10 rounded-t bg-brand"
              style={{
                height: `${maximum > 0 ? Math.max((point.amount / maximum) * 112, 3) : 3}px`,
              }}
            />
            <span
              aria-hidden="true"
              className="truncate text-micro text-ink-muted"
            >
              {new Intl.DateTimeFormat('en', { month: 'short' }).format(
                new Date(`${point.month_start}T00:00:00Z`),
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="text-body-strong">{summary}</p>
    </section>
  );
}
