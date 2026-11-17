// Share Meetings & AGM labels, India-time formatting, status chips, quorum and route states.
'use client';
import Link from 'next/link';
import { useUiTranslator } from '@/components/ui/language';
import {
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import { StatusChip } from '@/components/ui/data-display';
import { Banner, EmptyState, ErrorPanel } from '@/components/ui/feedback';
import { computeQuorum } from '@/core/meeting/quorum';
import type {
  MeetingAttendanceMode,
  MeetingOutcome,
  MeetingStatus,
  MeetingType,
} from '@/core/meeting/validation';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';

export type MeetingRouteStateKind =
  'disabled' | 'denied' | 'error' | 'not-found';

export const MEETING_LINK_CLASS =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-focus';
export const MEETING_PRIMARY_LINK_CLASS =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-space-4 text-body-strong text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export const MEETING_TYPE_NAMES: Readonly<Record<MeetingType, string>> = {
  agm: 'Annual general meeting (AGM)',
  sgm: 'Special general meeting (SGM)',
  committee: 'Committee meeting',
};

export const MEETING_MODE_LABELS: Readonly<
  Record<MeetingAttendanceMode, string>
> = {
  in_person: 'In person',
  online: 'Online',
  proxy: 'Proxy',
  self: 'Self check-in',
};

export const MEETING_OUTCOME_LABELS: Readonly<Record<MeetingOutcome, string>> =
  {
    pending: 'Pending',
    passed: 'Passed',
    failed: 'Failed',
    deferred: 'Deferred',
  };

export function formatMeetingDateTime(
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

export function formatMeetingDate(
  value: string | null | undefined,
  locale: Locale | null = null,
) {
  if (!value) return translateMessage(locale ?? 'en', 'No due date');
  return formatLocalizedDate(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
    locale ?? 'en',
    {
      dateStyle: 'medium',
      timeZone: 'UTC',
    },
  );
}

export function MeetingStatusChip({ status }: { status: MeetingStatus }) {
  return <StatusChip status={`meeting.${status}`} />;
}

export function MeetingActionChip({
  status,
  overdue,
}: {
  status: 'open' | 'done';
  overdue: boolean;
}) {
  return (
    <StatusChip
      status={
        status === 'done'
          ? 'meeting_action.done'
          : overdue
            ? 'meeting_action.overdue'
            : 'meeting_action.open'
      }
    />
  );
}

export function QuorumIndicator({
  invited,
  present,
  percent,
  meetingType,
}: {
  invited: number;
  present: number;
  percent: number | null;
  meetingType: MeetingType;
}) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const quorum = computeQuorum(invited, present, percent);
  const noun = t(meetingType === 'committee' ? 'members' : 'units');
  if (quorum.percent === null) {
    return (
      <p className="text-body text-ink-muted">
        {t(
          '{present} of {invited} invited {noun} present. The quorum rule is fixed when the meeting is scheduled.',
          {
            present: number(quorum.present),
            invited: number(quorum.invited),
            noun,
          },
        )}
      </p>
    );
  }
  return (
    <Banner
      title={t(quorum.met ? 'Quorum met' : 'Quorum not met')}
      tone={quorum.met ? 'success' : 'warning'}
    >
      {t(
        quorum.needed === null
          ? '{present} of {invited} invited {noun} present. The society rule is {percent}%. This is a guide only and does not block the meeting.'
          : '{present} of {invited} invited {noun} present. The society rule is {percent}% ({needed} needed). This is a guide only and does not block the meeting.',
        {
          present: number(quorum.present),
          invited: number(quorum.invited),
          noun,
          percent: number(quorum.percent),
          needed: quorum.needed === null ? '' : number(quorum.needed),
        },
      )}
    </Banner>
  );
}

export function NoticeWarning({
  requiredDays,
  givenDays,
}: {
  requiredDays: number | null | undefined;
  givenDays: number | null | undefined;
}) {
  const { locale, translate: t } = useUiTranslator();
  if (
    requiredDays === null ||
    requiredDays === undefined ||
    givenDays === null ||
    givenDays === undefined ||
    givenDays >= requiredDays
  )
    return null;
  const given = Math.max(givenDays, 0);
  return (
    <Banner title={t('Short notice')} tone="warning">
      {t(
        given === 1
          ? 'Members get {given} day of notice. The society rule is {required} days. This is a warning only.'
          : 'Members get {given} days of notice. The society rule is {required} days. This is a warning only.',
        {
          given: formatLocalizedNumber(given, locale ?? 'en'),
          required: formatLocalizedNumber(requiredDays, locale ?? 'en'),
        },
      )}
    </Banner>
  );
}

export function MeetingRouteState({
  kind,
  returnHref,
  retryHref,
  message,
  referenceId,
}: {
  kind: MeetingRouteStateKind;
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
        moduleKey="meeting"
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
          <Link className={MEETING_LINK_CLASS} href={returnHref}>
            {t('Back to Home')}
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title={t('We cannot find this meeting')}
        description={t('It may have been removed, or you may not be invited.')}
        action={
          <Link className={MEETING_LINK_CLASS} href={returnHref}>
            {t('Back to Meetings')}
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
          : t('We could not load this meeting. Refresh the page and try again.')
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link className={MEETING_LINK_CLASS} href={retryHref}>
              {t('Retry')}
            </Link>
          ) : null}
          <Link className={MEETING_LINK_CLASS} href={returnHref}>
            {t('Back')}
          </Link>
        </div>
      }
    />
  );
}
