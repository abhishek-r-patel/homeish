// Render shared P54 quick actions, Coming up rows and six-month graphs.
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveResidentGraphModeAction } from '@/app/(resident)/home/actions';
import {
  resetQuickActionPinsAction,
  saveQuickActionPinsAction,
  setGettingStartedDismissedAction,
} from '@/app/workspace-actions';
import { ModuleIcon } from '@/components/app-shells';
import { EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import type { ModuleKey } from '@/core/modules';
import type {
  ComingUpItem,
  ResidentDashboardGraph,
} from '@/core/home/dashboard-reads';
import type { GettingStarted } from '@/core/home/workspace-discovery';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  formatLocalizedCurrency,
  formatLocalizedDateTime,
} from '@/core/i18n/format';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type QuickAction = {
  key: string;
  href: string;
  label: string;
  moduleKey: ModuleKey;
};

export function GettingStartedCard({
  setup,
}: {
  setup: GettingStarted | null;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  if (!setup || setup.dismissed) return null;
  const completed = setup.steps.filter((step) => step.complete).length;
  if (completed === setup.steps.length) return null;

  function dismiss() {
    setMessage('');
    startTransition(async () => {
      const result = await setGettingStartedDismissedAction(true);
      setMessage(result.message ?? t('Getting started hidden.'));
    });
  }

  return (
    <section className="grid gap-space-4 rounded-lg border border-rule bg-surface p-space-5 shadow-card">
      <header className="flex items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <p className="text-micro font-semibold uppercase tracking-wide text-brand">
            {t('Getting started')}
          </p>
          <h2 className="text-heading">
            {t('{done} of {total} setup steps complete', {
              done: completed,
              total: setup.steps.length,
            })}
          </h2>
        </div>
        <button
          className="min-h-10 text-caption text-brand underline"
          disabled={pending}
          onClick={dismiss}
          type="button"
        >
          {t('Hide for now')}
        </button>
      </header>
      <progress
        className="h-2 w-full accent-brand"
        max={setup.steps.length}
        value={completed}
      />
      <ul className="grid gap-space-2">
        {setup.steps.map((step) => (
          <li key={step.key}>
            <Link
              className="flex min-h-12 items-center justify-between gap-space-3 rounded-md border border-rule px-space-4 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
              href={step.href}
            >
              <span>{t(step.title)}</span>
              <span
                className={`text-caption ${step.complete ? 'text-success' : 'text-ink-muted'}`}
              >
                {step.complete ? t('Complete') : t('Open')} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {message ? (
        <p className="text-caption text-danger" role="alert">
          {translateFeedback(message)}
        </p>
      ) : null}
    </section>
  );
}

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
  availableActions = actions,
  savePinsAction = saveQuickActionPinsAction,
  resetPinsAction = resetQuickActionPinsAction,
  firstFourOnPhone = false,
}: {
  actions: readonly QuickAction[];
  availableActions?: readonly QuickAction[];
  savePinsAction?: (keys: string[]) => Promise<ServerActionResult>;
  resetPinsAction?: () => Promise<ServerActionResult>;
  firstFourOnPhone?: boolean;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() =>
    actions.map((action) => action.key),
  );
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function toggle(key: string) {
    setMessage('');
    setSelected((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (current.length >= 8) {
        setMessage(t('You can pin up to 8 actions.'));
        return current;
      }
      return [...current, key];
    });
  }

  function move(key: string, direction: -1 | 1) {
    setSelected((current) => {
      const index = current.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function save() {
    setMessage('');
    startTransition(async () => {
      const result = await savePinsAction(selected);
      setMessage(result.message ?? t('Quick actions could not be saved.'));
      if (result.ok) setEditing(false);
    });
  }

  function reset() {
    setMessage('');
    startTransition(async () => {
      const result = await resetPinsAction();
      setMessage(result.message ?? t('Quick actions could not be reset.'));
      if (result.ok) setEditing(false);
    });
  }

  return (
    <section className="grid gap-space-3" aria-labelledby="quick-actions-title">
      <div className="flex items-end justify-between gap-space-3">
        <h2 className="text-heading" id="quick-actions-title">
          {t('Quick actions')}
        </h2>
        <button
          className="min-h-10 text-body-strong text-brand underline"
          onClick={() => setEditing(true)}
          type="button"
        >
          {t('Edit actions')}
        </button>
      </div>
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
      <Dialog
        description={t(
          'Choose and reorder up to 8 actions. Unavailable actions stay hidden without using a slot.',
        )}
        id="quick-action-editor"
        onOpenChange={setEditing}
        open={editing}
        title={t('Edit quick actions')}
      >
        <div className="grid gap-space-3">
          <ol className="grid gap-space-2">
            {selected.map((key, index) => {
              const action = availableActions.find((item) => item.key === key);
              if (!action) return null;
              return (
                <li
                  className="flex min-h-12 items-center gap-space-2 rounded-md border border-rule bg-surface px-space-3"
                  key={key}
                >
                  <span className="flex-1 text-body-strong">
                    {t(action.label)}
                  </span>
                  <button
                    aria-label={t('Move {action} up', {
                      action: t(action.label),
                    })}
                    className="min-h-10 min-w-10 rounded-sm hover:bg-surface-sunken"
                    disabled={pending || index === 0}
                    onClick={() => move(key, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={t('Move {action} down', {
                      action: t(action.label),
                    })}
                    className="min-h-10 min-w-10 rounded-sm hover:bg-surface-sunken"
                    disabled={pending || index === selected.length - 1}
                    onClick={() => move(key, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={t('Remove {action}', {
                      action: t(action.label),
                    })}
                    className="min-h-10 min-w-10 rounded-sm text-danger hover:bg-danger-tint"
                    disabled={pending}
                    onClick={() => toggle(key)}
                    type="button"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="grid gap-space-2">
            <h3 className="text-body-strong">{t('Available actions')}</h3>
            {availableActions
              .filter((action) => !selected.includes(action.key))
              .map((action) => (
                <label
                  className="flex min-h-12 items-center gap-space-3 rounded-md border border-rule px-space-3 text-body"
                  key={action.key}
                >
                  <input
                    checked={false}
                    disabled={pending}
                    onChange={() => toggle(action.key)}
                    type="checkbox"
                  />
                  {t(action.label)}
                </label>
              ))}
          </div>
          {message ? (
            <p className="text-caption text-danger" role="alert">
              {translateFeedback(message)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-space-2">
            <Button disabled={pending} loading={pending} onClick={save}>
              {t('Save actions')}
            </Button>
            <Button disabled={pending} onClick={reset} variant="secondary">
              {t('Reset to default')}
            </Button>
          </div>
        </div>
      </Dialog>
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
