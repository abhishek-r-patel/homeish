// Share Meetings & AGM labels, India-time formatting, status chips, quorum and route states.
import Link from 'next/link';
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

export function formatMeetingDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function formatMeetingDate(value: string | null | undefined) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
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
  const quorum = computeQuorum(invited, present, percent);
  const noun = meetingType === 'committee' ? 'members' : 'units';
  if (quorum.percent === null) {
    return (
      <p className="text-body text-ink-muted">
        {quorum.present} of {quorum.invited} invited {noun} present. The quorum
        rule is fixed when the meeting is scheduled.
      </p>
    );
  }
  return (
    <Banner
      title={quorum.met ? 'Quorum met' : 'Quorum not met'}
      tone={quorum.met ? 'success' : 'warning'}
    >
      {quorum.present} of {quorum.invited} invited {noun} present. The society
      rule is {quorum.percent}%
      {quorum.needed === null ? '' : ` (${quorum.needed} needed)`}. This is a
      guide only and does not block the meeting.
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
    <Banner title="Short notice" tone="warning">
      Members get {given} {given === 1 ? 'day' : 'days'} of notice. The society
      rule is {requiredDays} days. This is a warning only.
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
        title="You do not have access to this page"
        description="Return to your Homeish home page."
        action={
          <Link className={MEETING_LINK_CLASS} href={returnHref}>
            Back to Home
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title="We cannot find this meeting"
        description="It may have been removed, or you may not be invited."
        action={
          <Link className={MEETING_LINK_CLASS} href={returnHref}>
            Back to Meetings
          </Link>
        }
      />
    );
  }
  return (
    <ErrorPanel
      title="Something went wrong"
      message={
        message ??
        'We could not load this meeting. Refresh the page and try again.'
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link className={MEETING_LINK_CLASS} href={retryHref}>
              Retry
            </Link>
          ) : null}
          <Link className={MEETING_LINK_CLASS} href={returnHref}>
            Back
          </Link>
        </div>
      }
    />
  );
}
