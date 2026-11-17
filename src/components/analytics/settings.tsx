// Let an admin choose which committee analytics appear, grouped by module, with an optimistic version check.
'use client';
import { useUiTranslator } from '@/components/ui/language';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { getAnalyticsMetric } from '@/core/analytics/catalogue';
import { analyticsModuleLabel } from '@/core/analytics/format';
import type { AnalyticsSettings } from '@/core/analytics/validation';

type CatalogueEntry = AnalyticsSettings['catalogue'][number];

const linkClass =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

function groupByModule(catalogue: readonly CatalogueEntry[]) {
  const groups: { module: string; entries: CatalogueEntry[] }[] = [];
  for (const entry of catalogue) {
    const last = groups.at(-1);
    if (last && last.module === entry.module) last.entries.push(entry);
    else groups.push({ module: entry.module, entries: [entry] });
  }
  return groups;
}

function checkboxId(key: string) {
  return `analytics-metric-${key.replace(/\./g, '-')}`;
}

export function AnalyticsSettingsView({
  settings,
  action,
  dashboardHref,
}: {
  settings: AnalyticsSettings;
  action: ModuleFormAction;
  dashboardHref: string;
}) {
  const { translate: t } = useUiTranslator();
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(settings.metrics),
  );
  const groups = groupByModule(settings.catalogue);
  const enabledCount = settings.catalogue.filter(
    (entry) => entry.moduleEnabled && selected.has(entry.key),
  ).length;

  function toggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // Metrics of switched-off modules cannot be changed here, so restoring defaults leaves them as saved.
  function restoreDefaults() {
    setSelected(
      (current) =>
        new Set(
          settings.catalogue
            .filter((entry) =>
              entry.moduleEnabled ? entry.defaultOn : current.has(entry.key),
            )
            .map((entry) => entry.key),
        ),
    );
  }

  return (
    <div className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Analytics settings')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Choose the figures the committee sees on the analytics page. Every figure is a society total; no names or flat numbers are shown.',
          )}
        </p>
        <p>
          <Link className={linkClass} href={dashboardHref}>
            {t('Back to analytics')}
          </Link>
        </p>
      </header>
      <ModuleActionForm
        action={action}
        input={() => ({
          metrics: settings.catalogue
            .filter((entry) => selected.has(entry.key))
            .map((entry) => entry.key),
          expectedVersion: settings.version,
        })}
        submitLabel={t('Save settings')}
      >
        <div className="flex flex-wrap items-center justify-between gap-space-3">
          <p aria-live="polite" className="text-caption text-ink-muted">
            {t(
              enabledCount === 1
                ? '{count} figure selected'
                : '{count} figures selected',
              { count: enabledCount },
            )}
          </p>
          <Button onClick={restoreDefaults} type="button" variant="secondary">
            {t('Restore defaults')}
          </Button>
        </div>
        {groups.map((group) => {
          const moduleLabel = t(analyticsModuleLabel(group.module));
          const moduleOff = group.entries.every(
            (entry) => !entry.moduleEnabled,
          );
          return (
            <fieldset
              className="grid min-w-0 gap-space-1 rounded-md border border-rule bg-surface p-space-4"
              key={group.module}
            >
              <legend className="px-space-1 text-subheading">
                {moduleLabel}
                {moduleOff ? (
                  <span className="ml-space-2 text-caption font-normal text-ink-muted">
                    {t('(Module is off)')}
                  </span>
                ) : null}
              </legend>
              {group.entries.map((entry) => {
                const definition = getAnalyticsMetric(entry.key);
                const hints = [
                  definition?.description ? t(definition.description) : null,
                  entry.defaultOn ? t('On by default.') : null,
                  entry.moduleEnabled
                    ? null
                    : t('Module is off. Turn the module on to change this.'),
                ].filter(Boolean);
                return (
                  <div
                    className={entry.moduleEnabled ? '' : 'text-ink-muted'}
                    key={entry.key}
                  >
                    <CheckboxInput
                      checked={selected.has(entry.key)}
                      description={hints.join(' ')}
                      disabled={!entry.moduleEnabled}
                      id={checkboxId(entry.key)}
                      label={definition ? t(definition.label) : entry.key}
                      name="metrics"
                      onChange={(event) =>
                        toggle(entry.key, event.currentTarget.checked)
                      }
                      value={entry.key}
                    />
                  </div>
                );
              })}
            </fieldset>
          );
        })}
      </ModuleActionForm>
    </div>
  );
}
