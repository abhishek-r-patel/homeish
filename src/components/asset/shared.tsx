// Shared Asset Register route states, action wiring and small helpers.
'use client';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { formatPaise, warrantyState } from '@/core/asset/presentation';
import {
  addAssetMaintenanceAction,
  removeAssetMaintenanceAction,
  saveAssetAction,
  saveAssetCategoryAction,
  setAssetCategoryActiveAction,
} from '@/app/(admin)/admin/assets/actions';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';

export type AssetActions = {
  saveCategory: ModuleFormAction;
  setCategoryActive: ModuleFormAction;
  saveAsset: ModuleFormAction;
  addMaintenance: ModuleFormAction;
  removeMaintenance: ModuleFormAction;
};

export const ASSET_ACTIONS: AssetActions = {
  saveCategory: saveAssetCategoryAction,
  setCategoryActive: setAssetCategoryActiveAction,
  saveAsset: saveAssetAction,
  addMaintenance: addAssetMaintenanceAction,
  removeMaintenance: removeAssetMaintenanceAction,
};

export const ASSET_BASE_HREF = '/admin/assets';

export const ASSET_LINK_CLASS =
  'inline-flex min-h-12 items-center text-brand underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function useAssetCopy() {
  const {
    locale: activeLocale,
    translate,
    translateFeedback,
  } = useUiTranslator();
  const locale = activeLocale ?? 'en';
  return {
    locale,
    t: createComponentTranslator(locale, translate),
    translateFeedback,
  };
}

export function assetDisplayDate(value: string, locale: Locale) {
  return formatLocalizedDate(
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
    locale,
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  );
}

export function assetDisplayMoney(paise: number, locale: Locale) {
  return locale === 'hi'
    ? formatLocalizedCurrency(paise, locale)
    : formatPaise(paise);
}

export function assetWarrantyText(
  warrantyEndDate: string | null,
  today: string,
  locale: Locale,
  t: ReturnType<typeof createComponentTranslator>,
) {
  const state = warrantyState(warrantyEndDate, today);
  if (state === 'none' || !warrantyEndDate) return t('No warranty recorded');
  const date = assetDisplayDate(warrantyEndDate, locale);
  if (state === 'expired') return t('Warranty ended {date}', { date });
  if (state === 'ending_soon')
    return t('Warranty ends soon, on {date}', { date });
  return t('Under warranty until {date}', { date });
}

export type AssetRouteStateKind =
  'loading' | 'error' | 'disabled' | 'denied' | 'not_found';

export function AssetRouteState({
  kind,
  title = 'Asset Register',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: AssetRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  const { t, translateFeedback } = useAssetCopy();
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage embedded moduleKey="asset" returnHref={returnHref} />
    );
  const copy = {
    loading: {
      title: 'Loading the asset register',
      message: 'Loading the asset register.',
    },
    denied: {
      title: 'The Asset Register is for the admin and committee',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    not_found: {
      title: 'Not found',
      message: 'This asset does not exist in your society.',
    },
    error: {
      title: 'Could not load the asset register',
      message: 'Nothing has changed. Retry in a moment.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{t(title)}</h1>
      {kind === 'loading' ? (
        <Skeleton label={t(copy.title)} rows={5} />
      ) : (
        <ErrorPanel
          title={t(copy.title)}
          message={translateFeedback(message ?? copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a href={retryHref} className={ASSET_LINK_CLASS}>
                  {t('Retry')}
                </a>
              ) : null}
              <a href={returnHref} className={ASSET_LINK_CLASS}>
                {t('Back')}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Keeps a one-button action, such as deactivate or remove, consistent everywhere. */
export function AssetQuickAction({
  action,
  input,
  label,
  confirmMessage,
}: {
  action: ModuleFormAction;
  input: unknown;
  label: string;
  confirmMessage?: string;
}) {
  return (
    <ModuleActionForm
      action={action}
      input={() => input}
      submitLabel={label}
      confirmMessage={confirmMessage}
    >
      {null}
    </ModuleActionForm>
  );
}
