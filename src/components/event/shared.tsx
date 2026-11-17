// Share Events & RSVPs labels, India-time and money formatting, status chips and route states.
'use client';
import Link from 'next/link';
import { useUiTranslator } from '@/components/ui/language';
import {
  formatLocalizedCurrency,
  formatLocalizedDateTime,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import { StatusChip } from '@/components/ui/data-display';
import { EmptyState, ErrorPanel } from '@/components/ui/feedback';
import type {
  EventContributionTypeValue,
  EventRsvpStatus,
  EventStatus,
} from '@/core/event/validation';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import { rupeesFromPaise } from '@/lib/money';

export type EventRouteStateKind = 'disabled' | 'denied' | 'error' | 'not-found';

export const EVENT_LINK_CLASS =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-focus';
export const EVENT_PRIMARY_LINK_CLASS =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-space-4 text-body-strong text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function formatEventDateTime(
  value: string | null | undefined,
  locale: Locale | null = null,
) {
  if (!value) return translateMessage(locale ?? 'en', 'Not set');
  return formatLocalizedDateTime(new Date(value), locale ?? 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatEventMoney(paise: number, locale: Locale | null = null) {
  return locale === 'hi'
    ? formatLocalizedCurrency(paise, locale)
    : `₹${rupeesFromPaise(paise)}`;
}

export function describeContribution(
  type: EventContributionTypeValue,
  paise: number,
  locale: Locale | null = null,
) {
  if (type === 'none' || paise === 0)
    return translateMessage(locale ?? 'en', 'Free');
  return translateMessage(
    locale ?? 'en',
    type === 'per_unit' ? '{amount} per flat' : '{amount} per person',
    { amount: formatEventMoney(paise, locale) },
  );
}

export function EventStatusChip({
  status,
  past,
}: {
  status: EventStatus;
  past: boolean;
}) {
  return (
    <StatusChip
      status={status === 'published' && past ? 'event.past' : `event.${status}`}
    />
  );
}

export function EventRsvpChip({ status }: { status: EventRsvpStatus }) {
  return <StatusChip status={`event_rsvp.${status}`} />;
}

export function EventRouteState({
  kind,
  returnHref,
  retryHref,
  message,
  referenceId,
}: {
  kind: EventRouteStateKind;
  returnHref: string;
  retryHref?: string;
  message?: string;
  referenceId?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (kind === 'disabled') {
    return (
      <ModuleDisabledPage embedded moduleKey="event" returnHref={returnHref} />
    );
  }
  if (kind === 'denied') {
    return (
      <EmptyState
        title={t('You do not have access to this page')}
        description={t('Return to your Homeish home page.')}
        action={
          <Link className={EVENT_LINK_CLASS} href={returnHref}>
            {t('Back to Home')}
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title={t('We cannot find this event')}
        description={t(
          'It may have been removed, or it may not be open to your home.',
        )}
        action={
          <Link className={EVENT_LINK_CLASS} href={returnHref}>
            {t('Back to Events')}
          </Link>
        }
      />
    );
  }
  return (
    <ErrorPanel
      title={t('Something went wrong')}
      message={
        message
          ? translateFeedback(message)
          : t('We could not load this event. Refresh the page and try again.')
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link className={EVENT_LINK_CLASS} href={retryHref}>
              {t('Retry')}
            </Link>
          ) : null}
          <Link className={EVENT_LINK_CLASS} href={returnHref}>
            {t('Back')}
          </Link>
        </div>
      }
    />
  );
}
