// Share Community & Marketplace route states, link styles, status chips and page links.
'use client';
import Link from 'next/link';
import { useUiTranslator } from '@/components/ui/language';
import {
  formatLocalizedCurrency,
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import {
  formatCommunityDateTime as englishDateTime,
  formatCommunityPrice as englishPrice,
  authorLine as englishAuthorLine,
} from '@/core/community/presentation';
import type { ReactNode } from 'react';
import { StatusChip } from '@/components/ui/data-display';
import { EmptyState, ErrorPanel } from '@/components/ui/feedback';
import type { CommunityListingState } from '@/core/community/presentation';
import type {
  CommunityMute,
  CommunityItemStatus,
  CommunityReplyStatus,
} from '@/core/community/validation';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';

export type CommunityRouteStateKind =
  'disabled' | 'denied' | 'error' | 'not-found';

export const COMMUNITY_LINK_CLASS =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-focus';
export const COMMUNITY_PRIMARY_LINK_CLASS =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-space-4 text-body-strong text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function formatCommunityDateTime(
  value: string | null | undefined,
  locale: Locale | null = null,
) {
  if (!locale) return englishDateTime(value);
  return value
    ? formatLocalizedDateTime(new Date(value), locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      })
    : translateMessage(locale, 'Not set');
}

export function formatCommunityPrice(
  paise: number | null,
  locale: Locale | null = null,
) {
  if (locale !== 'hi') return englishPrice(paise);
  return paise === null
    ? null
    : paise === 0
      ? translateMessage(locale, 'Free')
      : formatLocalizedCurrency(paise, locale);
}

export function authorLine(
  name: string,
  unitLabel: string | null,
  locale: Locale | null = null,
) {
  return locale
    ? unitLabel
      ? translateMessage(locale, '{name} · Flat {label}', {
          name,
          label: unitLabel,
        })
      : name
    : englishAuthorLine(name, unitLabel);
}

export function muteEndsText(
  mute: CommunityMute,
  locale: Locale | null = null,
) {
  return mute.untilLifted || !mute.mutedUntil
    ? translateMessage(locale ?? 'en', 'until an administrator lifts it')
    : translateMessage(locale ?? 'en', 'until {date} IST', {
        date: formatCommunityDateTime(mute.mutedUntil, locale),
      });
}

export function CommunityStatusChip({
  status,
}: {
  status: CommunityItemStatus | CommunityReplyStatus | CommunityListingState;
}) {
  return (
    <StatusChip
      status={status === 'live' ? 'community.approved' : `community.${status}`}
    />
  );
}

export function CommunityPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-space-1">
      <h1 className="text-title font-semibold break-words">{title}</h1>
      {description ? (
        <p className="text-body text-ink-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export function CommunityPager({
  page,
  total,
  pageSize,
  href,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={t('Pages')}
      className="flex flex-wrap items-center gap-space-4 text-body"
    >
      {page > 1 ? (
        <Link className={COMMUNITY_LINK_CLASS} href={href(page - 1)}>
          {t('Newer')}
        </Link>
      ) : null}
      <span className="text-ink-muted">
        {t('Page {page} of {total}', {
          page: formatLocalizedNumber(Math.min(page, pages), locale ?? 'en'),
          total: formatLocalizedNumber(pages, locale ?? 'en'),
        })}
      </span>
      {page < pages ? (
        <Link className={COMMUNITY_LINK_CLASS} href={href(page + 1)}>
          {t('Older')}
        </Link>
      ) : null}
    </nav>
  );
}

export function CommunityRouteState({
  kind,
  returnHref,
  retryHref,
  message,
  referenceId,
}: {
  kind: CommunityRouteStateKind;
  returnHref: string;
  retryHref?: string;
  message?: string;
  referenceId?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (kind === 'disabled') {
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="community"
        returnHref={returnHref}
      />
    );
  }
  if (kind === 'denied') {
    return (
      <EmptyState
        title={t('You do not have access to this page')}
        description={t('Return to your Homeish home page.')}
        action={
          <Link className={COMMUNITY_LINK_CLASS} href={returnHref}>
            {t('Back')}
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title={t('We cannot find this')}
        description={t(
          'It may have been deleted or removed by an administrator, or it may not be open to you.',
        )}
        action={
          <Link className={COMMUNITY_LINK_CLASS} href={returnHref}>
            {t('Back to Community')}
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
          : t('We could not load this page. Refresh the page and retry.')
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link className={COMMUNITY_LINK_CLASS} href={retryHref}>
              {t('Retry')}
            </Link>
          ) : null}
          <Link className={COMMUNITY_LINK_CLASS} href={returnHref}>
            {t('Back')}
          </Link>
        </div>
      }
    />
  );
}
