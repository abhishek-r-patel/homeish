// Render resident meeting lists, details, self check-in, published outcomes and personal action items.
'use client';
import Link from 'next/link';
import { useId } from 'react';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import {
  MEETING_ACTION_NOTE_MAX,
  meetingActionStatusInputSchema,
  meetingSelfCheckinInputSchema,
  type MeetingMemberDetail,
  type MeetingMemberList,
  type MeetingMyAction,
} from '@/core/meeting/validation';
import {
  MEETING_LINK_CLASS,
  MEETING_MODE_LABELS,
  MEETING_OUTCOME_LABELS,
  MEETING_TYPE_NAMES,
  MeetingActionChip,
  MeetingStatusChip,
  QuorumIndicator,
  formatMeetingDate,
  formatMeetingDateTime,
} from './shared';

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '');
}

function isUpcoming(
  meeting: { status: string; endsAt: string | null },
  now: string,
) {
  return (
    meeting.status === 'scheduled' &&
    meeting.endsAt !== null &&
    new Date(meeting.endsAt).getTime() >= new Date(now).getTime()
  );
}

type ListMeeting = MeetingMemberList['meetings'][number];

function MeetingList({
  meetings,
  emptyTitle,
  emptyDescription,
}: {
  meetings: ListMeeting[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (meetings.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ul className="grid gap-space-2">
      {meetings.map((meeting) => (
        <li key={meeting.id}>
          <ListItem
            href={`/meetings/${meeting.id}`}
            title={<span className="break-words">{meeting.title}</span>}
            secondary={`${formatMeetingDateTime(meeting.startsAt)} IST${meeting.minutesPublished ? ' · Minutes' : ''}`}
            status={`meeting.${meeting.status}`}
          />
        </li>
      ))}
    </ul>
  );
}

export function MyMeetingActionsList({
  actions,
  action,
  meetingHrefBase,
  emptyDescription = 'Nothing is assigned to you right now.',
}: {
  actions: MeetingMyAction[];
  action: ModuleFormAction | null;
  meetingHrefBase: '/meetings' | '/admin/meetings';
  emptyDescription?: string;
}) {
  if (actions.length === 0) {
    return (
      <EmptyState
        title="No action items for you"
        description={emptyDescription}
      />
    );
  }
  return (
    <ul className="grid gap-space-3">
      {actions.map((item) => (
        <li key={item.id}>
          <MyActionCard
            item={item}
            action={action}
            meetingHrefBase={meetingHrefBase}
          />
        </li>
      ))}
    </ul>
  );
}

function MyActionCard({
  item,
  action,
  meetingHrefBase,
}: {
  item: MeetingMyAction;
  action: ModuleFormAction | null;
  meetingHrefBase: string;
}) {
  const id = useId();
  const nextStatus = item.status === 'done' ? 'open' : 'done';
  return (
    <Card
      title={item.title}
      action={<MeetingActionChip status={item.status} overdue={item.overdue} />}
    >
      <div className="grid min-w-0 gap-space-3">
        <p className="text-body text-ink-muted break-words">
          Due {formatMeetingDate(item.dueOn)} · From{' '}
          {item.meetingTitle === null ? (
            'a society meeting'
          ) : (
            <Link
              className={MEETING_LINK_CLASS}
              href={`${meetingHrefBase}/${item.meetingId}`}
            >
              {item.meetingTitle}
            </Link>
          )}
        </p>
        {action ? (
          <ModuleActionForm
            action={action}
            submitLabel={nextStatus === 'done' ? 'Mark as done' : 'Reopen'}
            input={(form) =>
              meetingActionStatusInputSchema.parse({
                actionId: item.id,
                expectedVersion: item.version,
                status: nextStatus,
                note: formText(form, 'note') || null,
              })
            }
          >
            <TextAreaInput
              id={`${id}-note`}
              name="note"
              label="Note (optional)"
              maxLength={MEETING_ACTION_NOTE_MAX}
              rows={2}
            />
          </ModuleActionForm>
        ) : null}
      </div>
    </Card>
  );
}

export function ResidentMeetingListView({
  workspace,
  now,
  statusAction,
}: {
  workspace: MeetingMemberList;
  now: string;
  statusAction: ModuleFormAction;
}) {
  const upcoming = workspace.meetings.filter((meeting) =>
    isUpcoming(meeting, now),
  );
  const past = workspace.meetings.filter(
    (meeting) => !isUpcoming(meeting, now),
  );
  return (
    <section className="grid min-w-0 gap-space-5">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">Meetings</h1>
        <p className="text-body text-ink-muted">
          Society general meetings for your home. All times are India time
          (IST).
        </p>
      </div>
      <section aria-labelledby="meetings-upcoming" className="grid gap-space-3">
        <h2 id="meetings-upcoming" className="text-subheading">
          Upcoming
        </h2>
        <MeetingList
          meetings={upcoming}
          emptyTitle="No upcoming meetings"
          emptyDescription="You will be notified when a meeting is scheduled."
        />
      </section>
      <section aria-labelledby="meetings-past" className="grid gap-space-3">
        <h2 id="meetings-past" className="text-subheading">
          Past and cancelled
        </h2>
        <MeetingList
          meetings={past}
          emptyTitle="No past meetings"
          emptyDescription="Held and cancelled meetings will appear here."
        />
      </section>
      <section aria-labelledby="meetings-actions" className="grid gap-space-3">
        <div className="flex flex-wrap items-baseline justify-between gap-space-2">
          <h2 id="meetings-actions" className="text-subheading">
            My action items
          </h2>
          <Link className={MEETING_LINK_CLASS} href="/meetings/actions">
            View all
          </Link>
        </div>
        <MyMeetingActionsList
          actions={workspace.actions.slice(0, 5)}
          action={statusAction}
          meetingHrefBase="/meetings"
        />
      </section>
    </section>
  );
}

function SelfCheckIn({
  detail,
  action,
}: {
  detail: MeetingMemberDetail;
  action: ModuleFormAction;
}) {
  const { meeting, myUnits } = detail;
  if (meeting.status !== 'scheduled' || myUnits.length === 0) return null;
  return (
    <Card
      title="Attendance"
      description={
        meeting.checkinOpen
          ? 'Check-in is open. Check in each home you are attending for.'
          : 'Check-in opens close to the start time, when the administrator opens it.'
      }
    >
      <ul className="grid gap-space-3">
        {myUnits.map((unit) => (
          <li key={unit.unitId} className="grid min-w-0 gap-space-2">
            <p className="text-body-strong break-words">Unit {unit.label}</p>
            {unit.present ? (
              <p role="status" className="text-body text-success">
                Present
                {unit.mode ? ` · ${MEETING_MODE_LABELS[unit.mode]}` : ''}
              </p>
            ) : meeting.checkinOpen && unit.canCheckIn ? (
              <ModuleActionForm
                action={action}
                submitLabel={`Check in unit ${unit.label}`}
                input={() =>
                  meetingSelfCheckinInputSchema.parse({
                    meetingId: meeting.id,
                    unitId: unit.unitId,
                  })
                }
              >
                <p className="text-caption text-ink-muted">
                  This marks your home as present at the meeting.
                </p>
              </ModuleActionForm>
            ) : (
              <p className="text-body text-ink-muted">
                {meeting.checkinOpen
                  ? 'Only an owner or tenant can check this home in.'
                  : 'Not checked in yet.'}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ResidentMeetingDetailView({
  detail,
  checkInAction,
}: {
  detail: MeetingMemberDetail;
  checkInAction: ModuleFormAction;
}) {
  const { meeting } = detail;
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link className={MEETING_LINK_CLASS} href="/meetings">
        Back to Meetings
      </Link>
      <div className="grid gap-space-2">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {meeting.title}
          </h1>
          <MeetingStatusChip status={meeting.status} />
        </div>
        <p className="text-body text-ink-muted">
          {MEETING_TYPE_NAMES[meeting.meetingType]}
        </p>
      </div>
      {meeting.status === 'cancelled' ? (
        <Banner title="This meeting was cancelled" tone="warning">
          {meeting.cancellationReason ?? 'No reason was given.'}
        </Banner>
      ) : null}
      <Card title="When and where">
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">Starts (IST)</dt>
            <dd>{formatMeetingDateTime(meeting.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Ends (IST)</dt>
            <dd>{formatMeetingDateTime(meeting.endsAt)}</dd>
          </div>
          {meeting.venue ? (
            <div>
              <dt className="text-caption text-ink-muted">Venue</dt>
              <dd className="break-words">{meeting.venue}</dd>
            </div>
          ) : null}
          {meeting.onlineUrl ? (
            <div>
              <dt className="text-caption text-ink-muted">Online link</dt>
              <dd className="break-all">
                <a
                  className={MEETING_LINK_CLASS}
                  href={meeting.onlineUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Join online
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        {meeting.description ? (
          <p className="mt-space-3 break-words whitespace-pre-line text-body">
            {meeting.description}
          </p>
        ) : null}
      </Card>
      <SelfCheckIn detail={detail} action={checkInAction} />
      <Card title="Agenda">
        {detail.agenda.length === 0 ? (
          <p className="text-body text-ink-muted">No agenda has been shared.</p>
        ) : (
          <ol className="grid list-decimal gap-space-2 pl-space-5 text-body">
            {detail.agenda.map((item) => (
              <li key={item.id} className="break-words">
                <span className="text-body-strong">{item.title}</span>
                {item.description ? (
                  <span className="block whitespace-pre-line text-ink-muted">
                    {item.description}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
      {meeting.status === 'held' ? (
        <>
          <Card title="Attendance summary">
            <QuorumIndicator
              invited={detail.quorum.invited}
              present={detail.quorum.present}
              percent={detail.quorum.percent}
              meetingType={meeting.meetingType}
            />
          </Card>
          <Card title="Resolutions">
            {detail.resolutions.length === 0 ? (
              <p className="text-body text-ink-muted">
                No resolutions were recorded.
              </p>
            ) : (
              <ul className="grid gap-space-3">
                {detail.resolutions.map((resolution) => (
                  <li key={resolution.id} className="grid gap-space-1">
                    <p className="text-body-strong break-words">
                      {resolution.title}
                    </p>
                    <p className="text-body">
                      Outcome: {MEETING_OUTCOME_LABELS[resolution.outcome]}
                      {resolution.votesFor !== null ||
                      resolution.votesAgainst !== null ||
                      resolution.votesAbstain !== null
                        ? ` · For ${resolution.votesFor ?? 0}, against ${resolution.votesAgainst ?? 0}, abstain ${resolution.votesAbstain ?? 0}`
                        : ''}
                    </p>
                    {resolution.poll ? (
                      <Link
                        className={MEETING_LINK_CLASS}
                        href={`/polls/${resolution.poll.id}`}
                      >
                        View linked poll: {resolution.poll.title}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
      {detail.minutes ? (
        <Card
          title="Minutes"
          description={`Published ${formatMeetingDateTime(detail.minutes.publishedAt)} IST`}
        >
          <p className="break-words whitespace-pre-line text-body">
            {detail.minutes.body}
          </p>
        </Card>
      ) : meeting.status === 'held' ? (
        <Card title="Minutes">
          <p className="text-body text-ink-muted">
            Minutes have not been published yet.
          </p>
        </Card>
      ) : null}
    </section>
  );
}

export function MyMeetingActionsView({
  actions,
  statusAction,
  meetingHrefBase,
  backHref,
}: {
  actions: MeetingMyAction[];
  statusAction: ModuleFormAction;
  meetingHrefBase: '/meetings' | '/admin/meetings';
  backHref: string;
}) {
  const open = actions.filter((item) => item.status === 'open');
  const done = actions.filter((item) => item.status === 'done');
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link className={MEETING_LINK_CLASS} href={backHref}>
        Back to Meetings
      </Link>
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">My action items</h1>
        <p className="text-body text-ink-muted">
          Tasks assigned to you at society meetings.
        </p>
      </div>
      <section aria-labelledby="actions-open" className="grid gap-space-3">
        <h2 id="actions-open" className="text-subheading">
          Open
        </h2>
        <MyMeetingActionsList
          actions={open}
          action={statusAction}
          meetingHrefBase={meetingHrefBase}
        />
      </section>
      {done.length ? (
        <section aria-labelledby="actions-done" className="grid gap-space-3">
          <h2 id="actions-done" className="text-subheading">
            Done
          </h2>
          <MyMeetingActionsList
            actions={done}
            action={statusAction}
            meetingHrefBase={meetingHrefBase}
          />
        </section>
      ) : null}
    </section>
  );
}
