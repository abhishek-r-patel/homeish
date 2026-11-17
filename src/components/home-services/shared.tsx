// Shared Home-Services route states, action wiring, rating display and provider contact.
'use client';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedDate, formatLocalizedNumber } from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { formatHomeServicesDate } from '@/core/home-services/presentation';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  homeServicesStarGlyphs,
  homeServicesTelHref,
} from '@/core/home-services/presentation';
import {
  archiveHomeServicesProviderAction,
  reviewHomeServicesSuggestionAction,
  saveHomeServicesProviderAction,
  saveHomeServicesRatingAction,
  setHomeServicesCommentVisibilityAction,
  suggestHomeServicesProviderAction,
} from '@/app/(resident)/home-services/actions';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';

export type HomeServicesActions = {
  saveProvider: ModuleFormAction;
  suggestProvider: ModuleFormAction;
  reviewSuggestion: ModuleFormAction;
  archiveProvider: ModuleFormAction;
  saveRating: ModuleFormAction;
  setCommentVisibility: ModuleFormAction;
};

export const HOME_SERVICES_ACTIONS: HomeServicesActions = {
  saveProvider: saveHomeServicesProviderAction,
  suggestProvider: suggestHomeServicesProviderAction,
  reviewSuggestion: reviewHomeServicesSuggestionAction,
  archiveProvider: archiveHomeServicesProviderAction,
  saveRating: saveHomeServicesRatingAction,
  setCommentVisibility: setHomeServicesCommentVisibilityAction,
};

export const HOME_SERVICES_LINK_CLASS =
  'inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus';

export type HomeServicesRouteStateKind =
  'loading' | 'error' | 'disabled' | 'denied';

export function formatHomeServicesUiDate(value: string, locale: Locale | null) {
  return locale
    ? formatLocalizedDate(new Date(value), locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : formatHomeServicesDate(value);
}

export function HomeServicesRouteState({
  kind,
  title = 'Home services',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: HomeServicesRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="home_services"
        returnHref={returnHref}
      />
    );
  const copy = {
    loading: {
      title: 'Loading home services',
      message: 'Loading home services.',
    },
    denied: {
      title: 'Home services access is restricted',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    error: {
      title: 'Could not load home services',
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
          message={message ? translateFeedback(message) : t(copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a href={retryHref} className={HOME_SERVICES_LINK_CLASS}>
                  {t('Retry')}
                </a>
              ) : null}
              <a href={returnHref} className={HOME_SERVICES_LINK_CLASS}>
                {t('Back to your workspace')}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Stars are decorative; the sentence beside them carries the meaning for every reader. */
export function HomeServicesRating({
  average,
  count,
}: {
  average: number | null;
  count: number;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <p className="flex flex-wrap items-center gap-space-2 text-caption text-ink-muted">
      {average !== null && count > 0 ? (
        <span aria-hidden="true" className="text-body text-warning">
          {homeServicesStarGlyphs(average)}
        </span>
      ) : null}
      <span>
        {count === 0 || average === null
          ? t('No ratings yet')
          : t(
              count === 1
                ? '{average} out of 5 from {count} rating'
                : '{average} out of 5 from {count} ratings',
              {
                average: formatLocalizedNumber(average, locale ?? 'en', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                count: formatLocalizedNumber(count, locale ?? 'en'),
              },
            )}
      </span>
    </p>
  );
}

export function HomeServicesPhone({
  name,
  phone,
}: {
  name: string;
  phone: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <a
      href={homeServicesTelHref(phone)}
      aria-label={t('Call {phone} for {name}', { phone, name })}
      className={HOME_SERVICES_LINK_CLASS}
    >
      {t('Call {phone}', { phone })}
    </a>
  );
}

export function HomeServicesCommentText({
  comment,
}: {
  comment: string | null;
}) {
  const { translate: t } = useUiTranslator();
  return comment === null ? (
    <p className="text-body text-ink-muted italic">
      {t('Comment hidden by an admin.')}
    </p>
  ) : (
    <p className="text-body break-words whitespace-pre-line">{comment}</p>
  );
}

/** Lists stop at 500 providers; say so rather than silently dropping the rest. */
export function HomeServicesTruncatedNote({
  truncated,
}: {
  truncated: boolean;
}) {
  const { translate: t } = useUiTranslator();
  return truncated ? (
    <p className="text-caption text-ink-muted">
      {t(
        'Only the first 500 providers are shown. Use the search or service type to narrow the list, or archive providers that are no longer needed.',
      )}
    </p>
  ) : null;
}

export function HomeServicesQuickAction({
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
