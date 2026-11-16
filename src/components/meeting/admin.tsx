// Render the meetings workspace: list, lifecycle, attendance, resolutions, minutes, action items and settings.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { z } from 'zod';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { DatePicker } from '@/components/ui/date-time-inputs';
import {
  MEETING_ACTION_TITLE_MAX,
  MEETING_ADMIN_MODES,
  MEETING_MINUTES_MAX,
  MEETING_OUTCOMES,
  MEETING_PROXY_NAME_MAX,
  MEETING_REASON_MAX,
  MEETING_RESOLUTION_BODY_MAX,
  MEETING_RESOLUTION_TITLE_MAX,
  MEETING_STATUSES,
  isUnitMeeting,
  meetingActionSaveInputSchema,
  meetingActionStatusInputSchema,
  meetingAttendanceRemoveInputSchema,
  meetingAttendanceSetInputSchema,
  meetingCancelInputSchema,
  meetingCheckinSetInputSchema,
  meetingDocumentCopyInputSchema,
  meetingMinutesPublishInputSchema,
  meetingMinutesSaveInputSchema,
  meetingOwnerOptionsSchema,
  meetingOwnerSearchInputSchema,
  meetingResolutionDeleteInputSchema,
  meetingResolutionOutcomeInputSchema,
  meetingResolutionPollCreateInputSchema,
  meetingResolutionPollLinkInputSchema,
  meetingResolutionSaveInputSchema,
  meetingSettingsInputSchema,
  meetingVersionInputSchema,
  type MeetingActionItem,
  type MeetingAdminDetail,
  type MeetingAdminList,
  type MeetingOwnerOption,
  type MeetingSettings,
  type MeetingStatus,
} from '@/core/meeting/validation';
import {
  MEETING_LINK_CLASS,
  MEETING_MODE_LABELS,
  MEETING_OUTCOME_LABELS,
  MEETING_PRIMARY_LINK_CLASS,
  MEETING_TYPE_NAMES,
  MeetingActionChip,
  MeetingStatusChip,
  NoticeWarning,
  QuorumIndicator,
  formatMeetingDate,
  formatMeetingDateTime,
} from './shared';

const ATTENDANCE_PAGE_SIZE = 100;
const STATUS_FILTER_LABELS: Readonly<Record<MeetingStatus, string>> = {
  draft: 'Drafts',
  scheduled: 'Scheduled',
  held: 'Held',
  cancelled: 'Cancelled',
};

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '');
}

function optionalCount(form: FormData, key: string) {
  const value = formText(form, key).trim();
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export type MeetingAdminWorkspace = MeetingAdminList & { canManage: boolean };

export type MeetingAdminDetailModel = MeetingAdminDetail & {
  settings: MeetingSettings;
  canManage: boolean;
  canWriteMinutes: boolean;
  pollEnabled: boolean;
  documentEnabled: boolean;
};

export type MeetingDocumentFolders = {
  folders: { id: string; name: string }[];
  defaultFolderId: string | null;
};

export type MeetingAdminActions = {
  schedule: ModuleFormAction;
  cancel: ModuleFormAction;
  deleteDraft: ModuleFormAction;
  markHeld: ModuleFormAction;
  setCheckin: ModuleFormAction;
  setAttendance: ModuleFormAction;
  removeAttendance: ModuleFormAction;
  saveResolution: ModuleFormAction;
  deleteResolution: ModuleFormAction;
  setOutcome: ModuleFormAction;
  linkPoll: ModuleFormAction;
  createPoll: ModuleFormAction;
  saveMinutes: ModuleFormAction;
  publishMinutes: ModuleFormAction;
  retryCopy: ModuleFormAction;
  saveAction: ModuleFormAction;
  setActionStatus: ModuleFormAction;
  searchOwners: ModuleFormAction;
};

export function MeetingAdminListView({
  workspace,
  status,
}: {
  workspace: MeetingAdminWorkspace;
  status: MeetingStatus | null;
}) {
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h1 className="text-title font-semibold">Meetings</h1>
          <p className="text-body text-ink-muted">
            Plan AGMs, SGMs and committee meetings, record attendance and
            publish minutes.
            {workspace.canManage
              ? ''
              : ' Committee members can review and draft minutes only.'}
          </p>
        </div>
        {workspace.canManage ? (
          <Link
            className={MEETING_PRIMARY_LINK_CLASS}
            href="/admin/meetings/new"
          >
            New meeting
          </Link>
        ) : null}
      </div>
      <nav aria-label="Meeting pages" className="flex flex-wrap gap-space-4">
        <Link className={MEETING_LINK_CLASS} href="/admin/meetings/actions">
          My action items
        </Link>
        <Link className={MEETING_LINK_CLASS} href="/admin/meetings/settings">
          Meeting settings
        </Link>
      </nav>
      <nav aria-label="Filter meetings" className="flex flex-wrap gap-space-3">
        <Link
          className={MEETING_LINK_CLASS}
          href="/admin/meetings"
          aria-current={status === null ? 'page' : undefined}
        >
          All
        </Link>
        {MEETING_STATUSES.map((value) => (
          <Link
            key={value}
            className={MEETING_LINK_CLASS}
            href={`/admin/meetings?status=${value}`}
            aria-current={status === value ? 'page' : undefined}
          >
            {STATUS_FILTER_LABELS[value]}
          </Link>
        ))}
      </nav>
      {workspace.items.length === 0 ? (
        <EmptyState
          title={status ? 'No meetings match this filter' : 'No meetings yet'}
          description={
            workspace.canManage
              ? 'Create a meeting draft, then schedule it to notify invitees.'
              : 'Your society has not planned a meeting yet.'
          }
          action={
            workspace.canManage ? (
              <Link className={MEETING_LINK_CLASS} href="/admin/meetings/new">
                Create a meeting
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-space-2">
          {workspace.items.map((meeting) => (
            <li key={meeting.id}>
              <ListItem
                href={`/admin/meetings/${meeting.id}`}
                title={
                  <span className="break-words">
                    {meeting.title || 'Untitled draft'}
                  </span>
                }
                secondary={`${meeting.meetingType.toUpperCase()} · ${formatMeetingDateTime(meeting.startsAt)} IST`}
                status={`meeting.${meeting.status}`}
                trailing={
                  meeting.status === 'draft'
                    ? undefined
                    : `${meeting.presentCount}/${meeting.invitedCount}`
                }
              />
            </li>
          ))}
        </ul>
      )}
      {workspace.total > workspace.items.length ? (
        <p className="text-caption text-ink-muted">
          Showing the newest {workspace.items.length} of {workspace.total}{' '}
          meetings.
        </p>
      ) : null}
    </section>
  );
}

function VersionAction({
  action,
  meetingId,
  version,
  label,
  confirmMessage,
  note,
}: {
  action: ModuleFormAction;
  meetingId: string;
  version: number;
  label: string;
  confirmMessage: string;
  note: string;
}) {
  return (
    <ModuleActionForm
      action={action}
      submitLabel={label}
      confirmMessage={confirmMessage}
      input={() =>
        meetingVersionInputSchema.parse({ meetingId, expectedVersion: version })
      }
    >
      <p className="text-caption text-ink-muted">{note}</p>
    </ModuleActionForm>
  );
}

function CancelAction({
  action,
  meetingId,
  version,
}: {
  action: ModuleFormAction;
  meetingId: string;
  version: number;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Cancel meeting"
      confirmMessage="Cancel this meeting? Invitees will be notified."
      input={(form) =>
        meetingCancelInputSchema.parse({
          meetingId,
          expectedVersion: version,
          reason: formText(form, 'reason'),
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label="Reason for cancelling"
        maxLength={MEETING_REASON_MAX}
        rows={2}
        required
      />
    </ModuleActionForm>
  );
}

function MeetingLifecycle({
  detail,
  actions,
}: {
  detail: MeetingAdminDetailModel;
  actions: MeetingAdminActions;
}) {
  const { meeting } = detail;
  if (!detail.canManage) return null;
  if (meeting.status === 'draft') {
    return (
      <Card title="Draft actions">
        <div className="grid gap-space-4">
          <Link
            className={MEETING_LINK_CLASS}
            href={`/admin/meetings/${meeting.id}/edit`}
          >
            Edit draft
          </Link>
          <VersionAction
            action={actions.schedule}
            meetingId={meeting.id}
            version={meeting.version}
            label="Schedule and notify"
            confirmMessage="Schedule this meeting? Every invitee will be notified."
            note="Scheduling fixes the invitee list, notice period and quorum rule, and notifies invitees."
          />
          <VersionAction
            action={actions.deleteDraft}
            meetingId={meeting.id}
            version={meeting.version}
            label="Delete draft"
            confirmMessage="Delete this draft? This cannot be undone."
            note="Only a draft can be deleted."
          />
        </div>
      </Card>
    );
  }
  if (meeting.status === 'scheduled') {
    return (
      <Card title="Meeting actions">
        <div className="grid gap-space-4">
          <Link
            className={MEETING_LINK_CLASS}
            href={`/admin/meetings/${meeting.id}/edit`}
          >
            Edit meeting
          </Link>
          {isUnitMeeting(meeting.meetingType) ? (
            <ModuleActionForm
              action={actions.setCheckin}
              submitLabel={
                meeting.checkinOpen
                  ? 'Close self check-in'
                  : 'Open self check-in'
              }
              input={() =>
                meetingCheckinSetInputSchema.parse({
                  meetingId: meeting.id,
                  open: !meeting.checkinOpen,
                })
              }
            >
              <p className="text-caption text-ink-muted">
                {meeting.checkinOpen
                  ? 'Owners and tenants can check their homes in now.'
                  : 'Check-in can open from one hour before the start until the meeting ends.'}
              </p>
            </ModuleActionForm>
          ) : null}
          <VersionAction
            action={actions.markHeld}
            meetingId={meeting.id}
            version={meeting.version}
            label="Mark as held"
            confirmMessage="Mark this meeting as held? Invitees and details will be frozen and check-in will close."
            note="After this you can record outcomes and write the minutes."
          />
          <CancelAction
            action={actions.cancel}
            meetingId={meeting.id}
            version={meeting.version}
          />
        </div>
      </Card>
    );
  }
  return null;
}

function AttendanceRow({
  meetingId,
  attendeeId,
  label,
  record,
  canManage,
  actions,
}: {
  meetingId: string;
  attendeeId: string;
  label: string;
  record: MeetingAdminDetail['attendance'][number] | undefined;
  canManage: boolean;
  actions: MeetingAdminActions;
}) {
  const id = useId();
  const [mode, setMode] = useState<string>(
    record && record.mode !== 'self' ? record.mode : 'in_person',
  );
  const summary = record
    ? `Present · ${MEETING_MODE_LABELS[record.mode]}${record.proxyName ? ` (${record.proxyName})` : ''}`
    : 'Not marked';
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3">
      <div className="flex flex-wrap items-baseline justify-between gap-space-2">
        <p className="text-body-strong break-words">{label}</p>
        <p
          className={`text-caption ${record ? 'text-success' : 'text-ink-muted'}`}
        >
          {summary}
        </p>
      </div>
      {canManage ? (
        <div className="grid min-w-0 gap-space-2 medium:grid-cols-2">
          <ModuleActionForm
            action={actions.setAttendance}
            submitLabel={`Save attendance for ${label}`}
            input={(form) =>
              meetingAttendanceSetInputSchema.parse({
                meetingId,
                attendeeId,
                mode,
                proxyName:
                  mode === 'proxy' ? formText(form, 'proxyName') || null : null,
              })
            }
          >
            <SelectInput
              id={`${id}-mode`}
              label={`Attendance for ${label}`}
              value={mode}
              options={MEETING_ADMIN_MODES.map((value) => ({
                value,
                label: MEETING_MODE_LABELS[value],
              }))}
              onChange={(event) => setMode(event.currentTarget.value)}
            />
            {mode === 'proxy' ? (
              <TextInput
                id={`${id}-proxy`}
                name="proxyName"
                label={`Proxy name for ${label}`}
                maxLength={MEETING_PROXY_NAME_MAX}
                defaultValue={record?.proxyName ?? ''}
                required
              />
            ) : null}
          </ModuleActionForm>
          {record ? (
            <ModuleActionForm
              action={actions.removeAttendance}
              submitLabel={`Remove mark for ${label}`}
              confirmMessage={`Remove the attendance mark for ${label}?`}
              input={() =>
                meetingAttendanceRemoveInputSchema.parse({
                  meetingId,
                  attendeeId,
                })
              }
            >
              <p className="text-caption text-ink-muted">
                Recorded {formatMeetingDateTime(record.recordedAt)} IST
                {record.recordedByName ? ` by ${record.recordedByName}` : ''}.
              </p>
            </ModuleActionForm>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AttendanceBoard({
  detail,
  actions,
}: {
  detail: MeetingAdminDetailModel;
  actions: MeetingAdminActions;
}) {
  const id = useId();
  const [filter, setFilter] = useState('');
  const { meeting } = detail;
  if (meeting.status === 'draft') return null;
  const byAttendee = new Map(
    detail.attendance.map((record) => [record.attendeeId, record]),
  );
  const canMark =
    detail.canManage &&
    (meeting.status === 'scheduled' || meeting.status === 'held');
  const query = filter.trim().toLowerCase();
  const matches = detail.invited.filter((invitee) =>
    invitee.label.toLowerCase().includes(query),
  );
  const shown = matches.slice(0, ATTENDANCE_PAGE_SIZE);
  return (
    <Card
      title="Attendance"
      description={
        isUnitMeeting(meeting.meetingType)
          ? 'One mark per invited unit. A proxy counts as present.'
          : 'One mark per invited committee member.'
      }
    >
      <div className="grid min-w-0 gap-space-4">
        <QuorumIndicator
          invited={detail.quorum.invited}
          present={detail.quorum.present}
          percent={detail.quorum.percent}
          meetingType={meeting.meetingType}
        />
        {detail.invited.length === 0 ? (
          <p className="text-body text-ink-muted">Nobody is invited yet.</p>
        ) : (
          <>
            {detail.invited.length > 10 ? (
              <TextInput
                id={`${id}-filter`}
                label="Find an invitee"
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.currentTarget.value)}
              />
            ) : null}
            <p role="status" className="text-caption text-ink-muted">
              Showing {shown.length} of {matches.length} invitees.
            </p>
            <ul className="grid gap-space-3">
              {shown.map((invitee) => (
                <AttendanceRow
                  key={invitee.attendeeId}
                  meetingId={meeting.id}
                  attendeeId={invitee.attendeeId}
                  label={invitee.label}
                  record={byAttendee.get(invitee.attendeeId)}
                  canManage={canMark}
                  actions={actions}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

type Resolution = MeetingAdminDetail['resolutions'][number];

function ResolutionForm({
  detail,
  resolution,
  action,
}: {
  detail: MeetingAdminDetailModel;
  resolution: Resolution | null;
  action: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={resolution ? 'Save resolution' : 'Add resolution'}
      input={(form) =>
        meetingResolutionSaveInputSchema.parse({
          meetingId: detail.meeting.id,
          resolutionId: resolution?.id ?? null,
          expectedVersion: resolution?.version ?? null,
          resolution: {
            title: formText(form, 'title'),
            body: formText(form, 'body') || null,
            agendaItemId: formText(form, 'agendaItemId') || null,
          },
        })
      }
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label="Resolution title"
        maxLength={MEETING_RESOLUTION_TITLE_MAX}
        defaultValue={resolution?.title ?? ''}
        required
      />
      <TextAreaInput
        id={`${id}-body`}
        name="body"
        label="Resolution text (optional)"
        maxLength={MEETING_RESOLUTION_BODY_MAX}
        defaultValue={resolution?.body ?? ''}
        rows={3}
      />
      {detail.agenda.length ? (
        <SelectInput
          id={`${id}-agenda`}
          name="agendaItemId"
          label="Agenda item (optional)"
          defaultValue={resolution?.agendaItemId ?? ''}
          options={[
            { value: '', label: 'Not linked to an agenda item' },
            ...detail.agenda.map((item, index) => ({
              value: item.id,
              label: `${index + 1}. ${item.title}`,
            })),
          ]}
        />
      ) : null}
    </ModuleActionForm>
  );
}

function ResolutionPoll({
  detail,
  resolution,
  actions,
}: {
  detail: MeetingAdminDetailModel;
  resolution: Resolution;
  actions: MeetingAdminActions;
}) {
  const id = useId();
  if (!detail.pollEnabled) {
    return (
      <p className="text-caption text-ink-muted">
        Turn on Polls & Voting to link a poll to this resolution.
      </p>
    );
  }
  if (resolution.poll) {
    return (
      <div className="grid gap-space-2">
        <p className="text-body break-words">
          Linked poll:{' '}
          <Link
            className={MEETING_LINK_CLASS}
            href={`/admin/polls/${resolution.poll.id}`}
          >
            {resolution.poll.title || 'Untitled poll'}
          </Link>{' '}
          ({resolution.poll.status})
        </p>
        {detail.canManage ? (
          <ModuleActionForm
            action={actions.linkPoll}
            submitLabel="Unlink poll"
            confirmMessage="Unlink this poll? The poll itself is not changed."
            input={() =>
              meetingResolutionPollLinkInputSchema.parse({
                resolutionId: resolution.id,
                expectedVersion: resolution.version,
                pollVoteId: null,
              })
            }
          >
            <span className="sr-only">
              Unlink the poll from {resolution.title}
            </span>
          </ModuleActionForm>
        ) : null}
      </div>
    );
  }
  if (!detail.canManage) {
    return <p className="text-caption text-ink-muted">No linked poll.</p>;
  }
  return (
    <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
      <ModuleActionForm
        action={actions.linkPoll}
        submitLabel="Link poll"
        input={(form) =>
          meetingResolutionPollLinkInputSchema.parse({
            resolutionId: resolution.id,
            expectedVersion: resolution.version,
            pollVoteId: formText(form, 'pollVoteId').trim(),
          })
        }
      >
        <TextInput
          id={`${id}-poll`}
          name="pollVoteId"
          label="Existing poll ID"
          helpText="Copy the ID from the poll’s address in Polls."
          required
        />
      </ModuleActionForm>
      <ModuleActionForm
        action={actions.createPoll}
        submitLabel="Create poll draft"
        idempotent
        input={(_form, clientRequestId) =>
          meetingResolutionPollCreateInputSchema.parse({
            meetingId: detail.meeting.id,
            resolutionId: resolution.id,
            expectedVersion: resolution.version,
            clientRequestId,
          })
        }
      >
        <p className="text-caption text-ink-muted">
          Creates a public draft poll with For, Against and Abstain, then links
          it here. Open it from Polls when ready.
        </p>
      </ModuleActionForm>
    </div>
  );
}

function ResolutionOutcome({
  resolution,
  action,
}: {
  resolution: Resolution;
  action: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Save outcome"
      input={(form) =>
        meetingResolutionOutcomeInputSchema.parse({
          resolutionId: resolution.id,
          expectedVersion: resolution.version,
          outcome: formText(form, 'outcome'),
          votesFor: optionalCount(form, 'votesFor'),
          votesAgainst: optionalCount(form, 'votesAgainst'),
          votesAbstain: optionalCount(form, 'votesAbstain'),
        })
      }
    >
      <SelectInput
        id={`${id}-outcome`}
        name="outcome"
        label="Outcome"
        defaultValue={resolution.outcome}
        options={MEETING_OUTCOMES.map((value) => ({
          value,
          label: MEETING_OUTCOME_LABELS[value],
        }))}
      />
      <div className="grid gap-space-3 medium:grid-cols-3">
        <TextInput
          id={`${id}-for`}
          name="votesFor"
          label="Votes for (optional)"
          inputMode="numeric"
          defaultValue={resolution.votesFor ?? ''}
        />
        <TextInput
          id={`${id}-against`}
          name="votesAgainst"
          label="Votes against (optional)"
          inputMode="numeric"
          defaultValue={resolution.votesAgainst ?? ''}
        />
        <TextInput
          id={`${id}-abstain`}
          name="votesAbstain"
          label="Abstentions (optional)"
          inputMode="numeric"
          defaultValue={resolution.votesAbstain ?? ''}
        />
      </div>
    </ModuleActionForm>
  );
}

function Resolutions({
  detail,
  actions,
}: {
  detail: MeetingAdminDetailModel;
  actions: MeetingAdminActions;
}) {
  const { meeting } = detail;
  const minutesPublished = detail.minutes?.status === 'published';
  const canEdit =
    detail.canManage && meeting.status !== 'cancelled' && !minutesPublished;
  if (meeting.status === 'cancelled' && detail.resolutions.length === 0)
    return null;
  return (
    <Card title="Resolutions">
      <div className="grid min-w-0 gap-space-4">
        {detail.resolutions.length === 0 ? (
          <p className="text-body text-ink-muted">No resolutions yet.</p>
        ) : (
          <ol className="grid gap-space-4">
            {detail.resolutions.map((resolution, index) => (
              <li
                key={resolution.id}
                className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-3"
              >
                <div className="grid gap-space-1">
                  <h3 className="text-body-strong break-words">
                    {index + 1}. {resolution.title}
                  </h3>
                  {resolution.body ? (
                    <p className="break-words whitespace-pre-line text-body">
                      {resolution.body}
                    </p>
                  ) : null}
                  <p className="text-body">
                    Outcome: {MEETING_OUTCOME_LABELS[resolution.outcome]}
                    {resolution.votesFor !== null ||
                    resolution.votesAgainst !== null ||
                    resolution.votesAbstain !== null
                      ? ` · For ${resolution.votesFor ?? 0}, against ${resolution.votesAgainst ?? 0}, abstain ${resolution.votesAbstain ?? 0}`
                      : ''}
                  </p>
                </div>
                <ResolutionPoll
                  detail={detail}
                  resolution={resolution}
                  actions={actions}
                />
                {detail.canManage &&
                meeting.status === 'held' &&
                !minutesPublished ? (
                  <ResolutionOutcome
                    resolution={resolution}
                    action={actions.setOutcome}
                  />
                ) : null}
                {canEdit ? (
                  <details className="grid gap-space-3">
                    <summary className="min-h-12 cursor-pointer py-space-2 text-body-strong text-brand">
                      Edit resolution {index + 1}
                    </summary>
                    <ResolutionForm
                      detail={detail}
                      resolution={resolution}
                      action={actions.saveResolution}
                    />
                    <ModuleActionForm
                      action={actions.deleteResolution}
                      submitLabel={`Delete resolution ${index + 1}`}
                      confirmMessage="Delete this resolution? This cannot be undone."
                      input={() =>
                        meetingResolutionDeleteInputSchema.parse({
                          resolutionId: resolution.id,
                          expectedVersion: resolution.version,
                        })
                      }
                    >
                      <span className="sr-only">Delete {resolution.title}</span>
                    </ModuleActionForm>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {canEdit ? (
          <section aria-label="Add a resolution" className="grid gap-space-3">
            <h3 className="text-body-strong">Add a resolution</h3>
            <ResolutionForm
              detail={detail}
              resolution={null}
              action={actions.saveResolution}
            />
          </section>
        ) : null}
      </div>
    </Card>
  );
}

function FolderSelect({
  id,
  folders,
}: {
  id: string;
  folders: MeetingDocumentFolders;
}) {
  if (folders.folders.length === 0) {
    return (
      <p className="text-caption text-ink-muted">
        No suitable Documents folder was found, so the minutes will not be
        copied to Documents.
      </p>
    );
  }
  return (
    <SelectInput
      id={id}
      name="folderId"
      label="Save a PDF copy in Documents folder"
      defaultValue={folders.defaultFolderId ?? folders.folders[0]?.id}
      options={folders.folders.map((folder) => ({
        value: folder.id,
        label: folder.name,
      }))}
    />
  );
}

function Minutes({
  detail,
  actions,
  folders,
}: {
  detail: MeetingAdminDetailModel;
  actions: MeetingAdminActions;
  folders: MeetingDocumentFolders;
}) {
  const id = useId();
  const { meeting, minutes } = detail;
  if (meeting.status !== 'held') return null;
  if (minutes?.status === 'published') {
    const copyFailed = detail.documentEnabled && minutes.documentId === null;
    return (
      <Card
        title="Minutes"
        description={`Published ${formatMeetingDateTime(minutes.publishedAt)} IST`}
      >
        <div className="grid min-w-0 gap-space-4">
          {copyFailed && detail.canManage ? (
            <Banner
              title="Minutes published; copying to Documents failed — Retry"
              tone="warning"
            >
              <ModuleActionForm
                action={actions.retryCopy}
                submitLabel="Retry copy to Documents"
                input={(form) =>
                  meetingDocumentCopyInputSchema.parse({
                    meetingId: meeting.id,
                    folderId: formText(form, 'folderId') || null,
                  })
                }
              >
                <FolderSelect id={`${id}-retry-folder`} folders={folders} />
              </ModuleActionForm>
            </Banner>
          ) : null}
          {minutes.documentId ? (
            <p className="text-body">
              A PDF copy is saved in{' '}
              <Link className={MEETING_LINK_CLASS} href="/admin/documents">
                Documents
              </Link>
              .
            </p>
          ) : null}
          <p className="break-words whitespace-pre-line text-body">
            {minutes.body}
          </p>
        </div>
      </Card>
    );
  }
  return (
    <Card
      title="Minutes"
      description={
        minutes
          ? `Draft last saved ${formatMeetingDateTime(minutes.updatedAt)} IST${minutes.updatedByName ? ` by ${minutes.updatedByName}` : ''}`
          : 'No minutes yet.'
      }
    >
      <div className="grid min-w-0 gap-space-4">
        {detail.canWriteMinutes ? (
          <ModuleActionForm
            action={actions.saveMinutes}
            submitLabel="Save minutes draft"
            input={(form) =>
              meetingMinutesSaveInputSchema.parse({
                meetingId: meeting.id,
                expectedVersion: minutes?.version ?? null,
                body: formText(form, 'body'),
              })
            }
          >
            <TextAreaInput
              id={`${id}-body`}
              name="body"
              label="Minutes"
              maxLength={MEETING_MINUTES_MAX}
              defaultValue={minutes?.body ?? ''}
              rows={12}
              required
              helpText="Administrators and committee members can edit the draft. Published minutes cannot be changed."
            />
          </ModuleActionForm>
        ) : minutes ? (
          <p className="break-words whitespace-pre-line text-body">
            {minutes.body}
          </p>
        ) : null}
        {detail.canManage && minutes ? (
          <ModuleActionForm
            action={actions.publishMinutes}
            submitLabel="Publish minutes"
            confirmMessage="Publish these minutes? They cannot be changed afterwards and invitees will be notified."
            input={(form) =>
              meetingMinutesPublishInputSchema.parse({
                meetingId: meeting.id,
                expectedVersion: minutes.version,
                folderId: formText(form, 'folderId') || null,
              })
            }
          >
            <p className="text-caption text-ink-muted">
              Save your latest changes first. Publishing shares the saved draft.
            </p>
            {detail.documentEnabled ? (
              <FolderSelect id={`${id}-folder`} folders={folders} />
            ) : null}
          </ModuleActionForm>
        ) : null}
      </div>
    </Card>
  );
}

function OwnerPicker({
  id,
  searchAction,
  owners,
  onOwners,
  defaultOwnerId,
}: {
  id: string;
  searchAction: ModuleFormAction;
  owners: MeetingOwnerOption[];
  onOwners: (owners: MeetingOwnerOption[]) => void;
  defaultOwnerId: string | null;
}) {
  return (
    <ModuleActionForm
      action={searchAction}
      submitLabel="Find people"
      refresh={false}
      input={(form) =>
        meetingOwnerSearchInputSchema.parse({
          search: formText(form, 'search'),
        })
      }
      onSaved={(data) => {
        const parsed = meetingOwnerOptionsSchema.shape.items.safeParse(data);
        if (!parsed.success) return;
        const kept = owners.filter(
          (owner) => owner.membershipId === defaultOwnerId,
        );
        onOwners([
          ...kept,
          ...parsed.data.filter(
            (owner) => owner.membershipId !== defaultOwnerId,
          ),
        ]);
      }}
    >
      <TextInput
        id={`${id}-search`}
        name="search"
        label="Search for an owner by name"
        type="search"
      />
    </ModuleActionForm>
  );
}

function ActionItemForm({
  detail,
  item,
  actions,
}: {
  detail: MeetingAdminDetailModel;
  item: MeetingActionItem | null;
  actions: MeetingAdminActions;
}) {
  const id = useId();
  const [owners, setOwners] = useState<MeetingOwnerOption[]>(
    item
      ? [
          {
            membershipId: item.ownerMembershipId,
            name: item.ownerName,
            roleLabel: '',
          },
        ]
      : [],
  );
  const [dueOn, setDueOn] = useState(item?.dueOn ?? '');
  return (
    <div className="grid min-w-0 gap-space-3">
      <OwnerPicker
        id={id}
        searchAction={actions.searchOwners}
        owners={owners}
        onOwners={setOwners}
        defaultOwnerId={item?.ownerMembershipId ?? null}
      />
      <ModuleActionForm
        action={actions.saveAction}
        submitLabel={item ? 'Save action item' : 'Add action item'}
        input={(form) =>
          meetingActionSaveInputSchema.parse({
            meetingId: detail.meeting.id,
            actionId: item?.id ?? null,
            expectedVersion: item?.version ?? null,
            action: {
              title: formText(form, 'title'),
              ownerMembershipId: formText(form, 'owner'),
              dueOn,
              resolutionId: formText(form, 'resolutionId') || null,
            },
          })
        }
      >
        <TextInput
          id={`${id}-title`}
          name="title"
          label="Action item"
          maxLength={MEETING_ACTION_TITLE_MAX}
          defaultValue={item?.title ?? ''}
          required
        />
        <SelectInput
          id={`${id}-owner`}
          name="owner"
          label="Owner"
          defaultValue={item?.ownerMembershipId ?? ''}
          placeholder={
            owners.length ? 'Choose an owner' : 'Search for an owner first'
          }
          helpText="Owners are notified when assigned."
          options={owners.map((owner) => ({
            value: owner.membershipId,
            label: owner.roleLabel
              ? `${owner.name} (${owner.roleLabel})`
              : owner.name,
          }))}
          required
        />
        <DatePicker
          id={`${id}-due`}
          label="Due date"
          value={dueOn}
          onChange={setDueOn}
          required
        />
        {detail.resolutions.length ? (
          <SelectInput
            id={`${id}-resolution`}
            name="resolutionId"
            label="Related resolution (optional)"
            defaultValue={item?.resolutionId ?? ''}
            options={[
              { value: '', label: 'Not linked to a resolution' },
              ...detail.resolutions.map((resolution, index) => ({
                value: resolution.id,
                label: `${index + 1}. ${resolution.title}`,
              })),
            ]}
          />
        ) : null}
      </ModuleActionForm>
    </div>
  );
}

function ActionItems({
  detail,
  actions,
}: {
  detail: MeetingAdminDetailModel;
  actions: MeetingAdminActions;
}) {
  const id = useId();
  const { meeting } = detail;
  const canEdit = detail.canManage && meeting.status !== 'cancelled';
  if (meeting.status === 'cancelled' && detail.actions.length === 0)
    return null;
  return (
    <Card title="Action items">
      <div className="grid min-w-0 gap-space-4">
        {detail.actions.length === 0 ? (
          <p className="text-body text-ink-muted">No action items yet.</p>
        ) : (
          <ul className="grid gap-space-3">
            {detail.actions.map((item, index) => (
              <li
                key={item.id}
                className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-space-2">
                  <h3 className="text-body-strong break-words">{item.title}</h3>
                  <MeetingActionChip
                    status={item.status}
                    overdue={item.overdue}
                  />
                </div>
                <p className="text-caption text-ink-muted break-words">
                  {item.ownerName} · Due {formatMeetingDate(item.dueOn)}
                  {item.note ? ` · Note: ${item.note}` : ''}
                </p>
                {canEdit ? (
                  <>
                    <ModuleActionForm
                      action={actions.setActionStatus}
                      submitLabel={
                        item.status === 'done'
                          ? `Reopen action ${index + 1}`
                          : `Mark action ${index + 1} done`
                      }
                      input={(form) =>
                        meetingActionStatusInputSchema.parse({
                          actionId: item.id,
                          expectedVersion: item.version,
                          status: item.status === 'done' ? 'open' : 'done',
                          note: formText(form, 'note') || null,
                        })
                      }
                    >
                      <TextInput
                        id={`${id}-${item.id}-note`}
                        name="note"
                        label={`Note for action ${index + 1} (optional)`}
                        maxLength={500}
                      />
                    </ModuleActionForm>
                    <details className="grid gap-space-3">
                      <summary className="min-h-12 cursor-pointer py-space-2 text-body-strong text-brand">
                        Edit action {index + 1}
                      </summary>
                      <ActionItemForm
                        detail={detail}
                        item={item}
                        actions={actions}
                      />
                    </details>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <section aria-label="Add an action item" className="grid gap-space-3">
            <h3 className="text-body-strong">Add an action item</h3>
            <ActionItemForm detail={detail} item={null} actions={actions} />
          </section>
        ) : null}
      </div>
    </Card>
  );
}

export function MeetingAdminDetailView({
  detail,
  actions,
  folders,
}: {
  detail: MeetingAdminDetailModel;
  actions: MeetingAdminActions;
  folders: MeetingDocumentFolders;
}) {
  const { meeting } = detail;
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link className={MEETING_LINK_CLASS} href="/admin/meetings">
        Back to Meetings
      </Link>
      <div className="grid gap-space-2">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {meeting.title || 'Untitled draft'}
          </h1>
          <MeetingStatusChip status={meeting.status} />
        </div>
        <p className="text-body text-ink-muted">
          {MEETING_TYPE_NAMES[meeting.meetingType]}
        </p>
      </div>
      {!detail.canManage ? (
        <Card title="Committee view">
          <p className="text-body text-ink-muted">
            You can review this meeting
            {meeting.status === 'held' ? ' and edit the minutes draft' : ''}.
            Only administrators can change anything else.
          </p>
        </Card>
      ) : null}
      {meeting.status === 'cancelled' ? (
        <Banner title="This meeting was cancelled" tone="warning">
          {meeting.cancellationReason ?? 'No reason was recorded.'}
        </Banner>
      ) : null}
      {meeting.status === 'scheduled' ? (
        <NoticeWarning
          requiredDays={meeting.noticeRequiredDays}
          givenDays={meeting.noticeGivenDays}
        />
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
          <div>
            <dt className="text-caption text-ink-muted">Venue</dt>
            <dd className="break-words">{meeting.venue ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Online link</dt>
            <dd className="break-all">{meeting.onlineUrl ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Invitees</dt>
            <dd>
              {detail.invitees.scope === 'default'
                ? isUnitMeeting(meeting.meetingType)
                  ? 'Every active unit'
                  : 'Every committee member'
                : 'A chosen list'}
              {meeting.status === 'draft'
                ? ''
                : ` · ${detail.invited.length} invited`}
            </dd>
          </div>
        </dl>
        {meeting.description ? (
          <p className="mt-space-3 break-words whitespace-pre-line text-body">
            {meeting.description}
          </p>
        ) : null}
      </Card>
      <Card title="Agenda">
        {detail.agenda.length === 0 ? (
          <p className="text-body text-ink-muted">No agenda items yet.</p>
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
      <MeetingLifecycle detail={detail} actions={actions} />
      <AttendanceBoard detail={detail} actions={actions} />
      {meeting.status !== 'draft' ? (
        <Resolutions detail={detail} actions={actions} />
      ) : null}
      <Minutes detail={detail} actions={actions} folders={folders} />
      {meeting.status !== 'draft' ? (
        <ActionItems detail={detail} actions={actions} />
      ) : null}
    </section>
  );
}

const settingsFormSchema = z.object({
  notice_days_agm: z.coerce.number(),
  notice_days_sgm: z.coerce.number(),
  notice_days_committee: z.coerce.number(),
  quorum_percent_units: z.coerce.number(),
  quorum_percent_committee: z.coerce.number(),
  action_owner_scope: z.string(),
});

export function MeetingSettingsView({
  settings,
  canManage,
  action,
}: {
  settings: MeetingSettings;
  canManage: boolean;
  action: ModuleFormAction | null;
}) {
  const id = useId();
  const numberField = (
    name: Exclude<keyof MeetingSettings, 'action_owner_scope'>,
    label: string,
    helpText: string,
    max: number,
  ) => (
    <TextInput
      id={`${id}-${name}`}
      name={name}
      label={label}
      helpText={helpText}
      type="number"
      inputMode="numeric"
      min={name.startsWith('quorum') ? 1 : 0}
      max={max}
      defaultValue={settings[name]}
      disabled={!canManage}
      required
    />
  );
  const fields = (
    <>
      {numberField(
        'notice_days_agm',
        'AGM notice (days)',
        'Whole days of notice expected before an AGM.',
        90,
      )}
      {numberField(
        'notice_days_sgm',
        'SGM notice (days)',
        'Whole days of notice expected before an SGM.',
        90,
      )}
      {numberField(
        'notice_days_committee',
        'Committee meeting notice (days)',
        'Whole days of notice expected before a committee meeting.',
        90,
      )}
      {numberField(
        'quorum_percent_units',
        'AGM and SGM quorum (% of invited units)',
        'Shown as a guide; it never blocks a meeting.',
        100,
      )}
      {numberField(
        'quorum_percent_committee',
        'Committee quorum (% of invited members)',
        'Shown as a guide; it never blocks a meeting.',
        100,
      )}
      <SelectInput
        id={`${id}-owner-scope`}
        name="action_owner_scope"
        label="Who can own action items"
        defaultValue={settings.action_owner_scope}
        disabled={!canManage}
        options={[
          {
            value: 'any_member',
            label: 'Any resident, committee member or admin',
          },
          { value: 'management', label: 'Committee members and admins only' },
        ]}
      />
    </>
  );
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link className={MEETING_LINK_CLASS} href="/admin/meetings">
        Back to Meetings
      </Link>
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">Meeting settings</h1>
        <p className="text-body text-ink-muted">
          Notice and quorum rules are warnings only. They are fixed on each
          meeting when it is scheduled.
        </p>
      </div>
      <Card title="Rules">
        {canManage && action ? (
          <ModuleActionForm
            action={action}
            submitLabel="Save settings"
            input={(form) => {
              const values = settingsFormSchema.parse(
                Object.fromEntries(form.entries()),
              );
              return meetingSettingsInputSchema.parse(values);
            }}
          >
            {fields}
          </ModuleActionForm>
        ) : (
          <div className="grid gap-space-3">
            {fields}
            <p className="text-caption text-ink-muted">
              Only administrators can change these settings.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}
