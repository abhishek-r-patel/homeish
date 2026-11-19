// Shared route states and date formatting for the P35 society profile, adoption and action-plan screens.
'use client';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedDate } from '@/core/i18n/format';

export type ToolkitRouteStateKind = 'loading' | 'error' | 'denied';

const COPY = {
  loading: {
    title: 'Loading',
    message: 'Loading',
  },
  denied: {
    title: 'You do not have access to this view',
    message:
      'Return to your workspace or ask an administrator to review your access.',
  },
  error: {
    title: 'Could not load this page',
    message: 'Nothing has changed. Retry in a moment.',
  },
} as const;

export function ToolkitRouteState({
  kind,
  title,
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: ToolkitRouteStateKind;
  title: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const copy = COPY[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{t(title)}</h1>
      {kind === 'loading' ? (
        <Skeleton label={t(title)} rows={5} />
      ) : (
        <ErrorPanel
          title={t(copy.title)}
          message={message ? translateFeedback(message) : t(copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a
                  href={retryHref}
                  className="inline-flex min-h-12 items-center text-brand underline"
                >
                  {t('Retry')}
                </a>
              ) : null}
              <a
                href={returnHref}
                className="inline-flex min-h-12 items-center text-brand underline"
              >
                {t('Back')}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Formats YYYY-MM-DD calendar dates without shifting them across time zones. */
export function useToolkitDates() {
  const { locale } = useUiTranslator();
  const language = locale ?? 'en';
  return {
    locale: language,
    date(value: string) {
      return formatLocalizedDate(
        new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
        language,
        { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
      );
    },
    month(value: number) {
      return formatLocalizedDate(
        new Date(Date.UTC(2000, value - 1, 1)),
        language,
        {
          month: 'long',
          timeZone: 'UTC',
        },
      );
    },
  };
}
