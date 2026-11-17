// Render the events workspace for administrators and committee: list, details, totals, RSVPs and lifecycle.
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
import { DataTable } from '@/components/ui/table-controls';
import {
  EVENT_ADMIN_FILTERS,
  EVENT_REASON_MAX,
  eventCancelInputSchema,
  eventVersionInputSchema,
  type EventAdminDetail,
  type EventAdminFilter,
  type EventAdminList,
  type EventBlockOption,
} from '@/core/event/validation';
import {
  EVENT_LINK_CLASS,
  EVENT_PRIMARY_LINK_CLASS,
  EventRsvpChip,
  EventStatusChip,
  describeContribution,
  formatEventDateTime,
  formatEventMoney,
} from './shared';

const FILTER_LABELS: Readonly<Record<EventAdminFilter, string>> = {
  upcoming: 'Upcoming',
  past: 'Past',
  drafts: 'Drafts',
  cancelled: 'Cancelled',
  all: 'All',
};

export type EventAdminWorkspace = EventAdminList & { billingEnabled: boolean };

export type EventAdminActions = {
  publish: ModuleFormAction;
  cancel: ModuleFormAction;
  deleteDraft: ModuleFormAction;
};

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '');
}

function goingSummary(item: EventAdminList['items'][number]) {
  const people = `${item.goingHeadcount} going`;
  const flats = `${item.goingUnits} ${item.goingUnits === 1 ? 'flat' : 'flats'}`;
  return item.capacity === null
    ? `${people} · ${flats}`
    : `${item.goingHeadcount}/${item.capacity} going · ${flats}`;
}

export function EventAdminListView({
  workspace,
  filter,
  basePath = '/admin/events',
}: {
  workspace: EventAdminWorkspace;
  filter: EventAdminFilter;
  basePath?: string;
}) {
  const needsBilling =
    !workspace.billingEnabled &&
    workspace.items.some(
      (item) => item.contributionType !== 'none' && item.status !== 'cancelled',
    );
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h1 className="text-title font-semibold">Events</h1>
          <p className="text-body text-ink-muted">
            Plan society events, collect RSVPs and optional contributions. All
            times are India time (IST).
          </p>
        </div>
        <Link className={EVENT_PRIMARY_LINK_CLASS} href="/admin/events/new">
          New Event
        </Link>
      </div>
      {needsBilling ? (
        <Banner title="Billing is turned off" tone="warning">
          Some events have a contribution. Residents cannot RSVP going to them
          until Billing is turned on.
        </Banner>
      ) : null}
      <nav aria-label="Filter events" className="flex flex-wrap gap-space-3">
        {EVENT_ADMIN_FILTERS.map((value) => (
          <Link
            key={value}
            className={EVENT_LINK_CLASS}
            href={
              value === 'upcoming' ? basePath : `${basePath}?filter=${value}`
            }
            aria-current={filter === value ? 'page' : undefined}
          >
            {FILTER_LABELS[value]}
          </Link>
        ))}
      </nav>
      {workspace.items.length === 0 ? (
        <EmptyState
          title={
            filter === 'upcoming'
              ? 'No upcoming events'
              : 'No events match this filter'
          }
          description="Create an event draft, then publish it to notify residents."
          action={
            <Link className={EVENT_LINK_CLASS} href="/admin/events/new">
              Create an event
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-space-2">
          {workspace.items.map((item) => (
            <li key={item.id}>
              <ListItem
                href={`/admin/events/${item.id}`}
                title={<span className="break-words">{item.title}</span>}
                secondary={
                  <span className="break-words">
                    {formatEventDateTime(item.startsAt)} IST
                    {item.venue ? ` · ${item.venue}` : ''} ·{' '}
                    {describeContribution(
                      item.contributionType,
                      item.contributionPaise,
                    )}
                    {item.status === 'draft' ? '' : ` · ${goingSummary(item)}`}
                  </span>
                }
                status={
                  item.status === 'published' && item.past
                    ? 'event.past'
                    : `event.${item.status}`
                }
              />
            </li>
          ))}
        </ul>
      )}
      {workspace.total > workspace.items.length ? (
        <p className="text-caption text-ink-muted">
          Showing {workspace.items.length} of {workspace.total} events.
        </p>
      ) : null}
    </section>
  );
}

function VersionAction({
  action,
  eventId,
  version,
  label,
  confirmMessage,
  note,
  disabled = false,
}: {
  action: ModuleFormAction;
  eventId: string;
  version: number;
  label: string;
  confirmMessage: string;
  note: string;
  disabled?: boolean;
}) {
  return (
    <ModuleActionForm
      action={action}
      submitLabel={label}
      confirmMessage={confirmMessage}
      submitDisabled={disabled}
      input={() =>
        eventVersionInputSchema.parse({ eventId, expectedVersion: version })
      }
    >
      <p className="text-caption text-ink-muted">{note}</p>
    </ModuleActionForm>
  );
}

function CancelAction({
  action,
  eventId,
  version,
  hasContribution,
}: {
  action: ModuleFormAction;
  eventId: string;
  version: number;
  hasContribution: boolean;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Cancel Event"
      confirmMessage={
        hasContribution
          ? 'Cancel this event? Residents will be notified and every contribution will be credited back.'
          : 'Cancel this event? Residents will be notified.'
      }
      input={(form) =>
        eventCancelInputSchema.parse({
          eventId,
          expectedVersion: version,
          reason: formText(form, 'reason'),
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label="Reason for cancelling"
        helpText="Residents see this reason."
        maxLength={EVENT_REASON_MAX}
        rows={2}
        required
      />
    </ModuleActionForm>
  );
}

function EventLifecycle({
  detail,
  actions,
}: {
  detail: EventAdminDetail;
  actions: EventAdminActions;
}) {
  const { event } = detail;
  const billingBlocked =
    event.contributionType !== 'none' && !detail.billingEnabled;
  if (event.status === 'draft') {
    return (
      <Card title="Draft actions">
        <div className="grid gap-space-4">
          <Link
            className={EVENT_LINK_CLASS}
            href={`/admin/events/${event.id}/edit`}
          >
            Edit draft
          </Link>
          <VersionAction
            action={actions.publish}
            eventId={event.id}
            version={event.version}
            label="Publish and Notify"
            confirmMessage="Publish this event? Residents in the audience will be notified."
            note={
              billingBlocked
                ? 'Turn on Billing, or remove the contribution, before publishing.'
                : 'Publishing notifies residents and opens RSVPs. The contribution cannot be changed afterwards.'
            }
            disabled={billingBlocked}
          />
          <VersionAction
            action={actions.deleteDraft}
            eventId={event.id}
            version={event.version}
            label="Delete Draft"
            confirmMessage="Delete this draft? This cannot be undone."
            note="Only a draft can be deleted."
          />
        </div>
      </Card>
    );
  }
  if (event.status === 'published' && !event.past) {
    return (
      <Card title="Event actions">
        <div className="grid gap-space-4">
          <Link
            className={EVENT_LINK_CLASS}
            href={`/admin/events/${event.id}/edit`}
          >
            Edit event
          </Link>
          <CancelAction
            action={actions.cancel}
            eventId={event.id}
            version={event.version}
            hasContribution={event.contributionType !== 'none'}
          />
        </div>
      </Card>
    );
  }
  return null;
}

function audienceText(
  audience: EventAdminDetail['event']['audience'],
  blocks: readonly EventBlockOption[],
) {
  if (audience.scope === 'all') return 'Every active flat';
  const names = audience.blockIds.map(
    (blockId) =>
      blocks.find((block) => block.blockId === blockId)?.name ??
      'An inactive block',
  );
  return names.length === 0 ? 'No blocks chosen yet' : names.join(', ');
}

type RsvpRow = EventAdminDetail['rsvps'][number];

function RsvpTable({ detail }: { detail: EventAdminDetail }) {
  if (detail.rsvps.length === 0) {
    return (
      <Card title="RSVPs">
        <p className="text-body text-ink-muted">No RSVPs yet.</p>
      </Card>
    );
  }
  const showCharges = detail.event.contributionType !== 'none';
  return (
    <Card title="RSVPs" description="One response per flat.">
      <DataTable<RsvpRow>
        caption="RSVPs by flat"
        rows={detail.rsvps}
        getRowId={(row) => row.rsvpId}
        getRowLabel={(row) => row.unitLabel}
        mobilePrimary={(row) => `Flat ${row.unitLabel}`}
        mobileSecondary={(row) =>
          [
            row.status === 'going' ? `${row.headcount} going` : null,
            showCharges ? formatEventMoney(row.netChargePaise) : null,
            `${row.respondedByName ?? 'A resident'} · ${formatEventDateTime(row.respondedAt)} IST`,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        mobileStatus={(row) => `event_rsvp.${row.status}`}
        columns={[
          {
            id: 'unit',
            header: 'Flat',
            render: (row) => row.unitLabel,
          },
          {
            id: 'status',
            header: 'Response',
            render: (row) => <EventRsvpChip status={row.status} />,
          },
          {
            id: 'headcount',
            header: 'People',
            align: 'right',
            render: (row) => row.headcount,
          },
          ...(showCharges
            ? [
                {
                  id: 'charge',
                  header: 'Charged',
                  align: 'right' as const,
                  render: (row: RsvpRow) =>
                    formatEventMoney(row.netChargePaise),
                },
              ]
            : []),
          {
            id: 'responded',
            header: 'Answered by',
            render: (row) =>
              `${row.respondedByName ?? 'A resident'} · ${formatEventDateTime(row.respondedAt)} IST`,
          },
        ]}
      />
    </Card>
  );
}

export function EventAdminDetailView({
  detail,
  blocks,
  actions,
  backHref = '/admin/events',
}: {
  detail: EventAdminDetail;
  blocks: readonly EventBlockOption[];
  actions: EventAdminActions;
  backHref?: string;
}) {
  const { event, totals } = detail;
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link className={EVENT_LINK_CLASS} href={backHref}>
        Back to Events
      </Link>
      <div className="flex flex-wrap items-center gap-space-2">
        <h1 className="text-title font-semibold break-words">{event.title}</h1>
        <EventStatusChip status={event.status} past={event.past} />
      </div>
      {event.status === 'cancelled' ? (
        <Banner title="This event was cancelled" tone="warning">
          {event.cancellationReason ?? 'No reason was recorded.'}
        </Banner>
      ) : null}
      {event.contributionType !== 'none' &&
      !detail.billingEnabled &&
      event.status !== 'cancelled' ? (
        <Banner title="Billing is turned off" tone="warning">
          This event has a contribution. It cannot be published, and residents
          cannot RSVP going, until Billing is turned on.
        </Banner>
      ) : null}
      <Card title="When and where">
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">Starts (IST)</dt>
            <dd>{formatEventDateTime(event.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Ends (IST)</dt>
            <dd>{formatEventDateTime(event.endsAt)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Venue</dt>
            <dd className="break-words">{event.venue ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">RSVP deadline (IST)</dt>
            <dd>
              {event.rsvpDeadline
                ? formatEventDateTime(event.rsvpDeadline)
                : 'When the event starts'}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Who is invited</dt>
            <dd className="break-words">
              {audienceText(event.audience, blocks)}
            </dd>
          </div>
        </dl>
        {event.description ? (
          <p className="mt-space-3 break-words whitespace-pre-line text-body">
            {event.description}
          </p>
        ) : null}
      </Card>
      <Card title="Limits and contribution">
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">Capacity</dt>
            <dd>
              {event.capacity === null
                ? 'No limit'
                : `${event.capacity} people`}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Limit per flat</dt>
            <dd>
              {event.maxPerUnit === null
                ? 'No limit'
                : `${event.maxPerUnit} ${event.maxPerUnit === 1 ? 'person' : 'people'}`}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Contribution</dt>
            <dd>
              {describeContribution(
                event.contributionType,
                event.contributionPaise,
              )}
            </dd>
          </div>
        </dl>
      </Card>
      {event.status !== 'draft' ? (
        <Card title="Totals">
          <dl className="grid gap-space-3 text-body medium:grid-cols-2">
            <div>
              <dt className="text-caption text-ink-muted">People going</dt>
              <dd className="text-body-strong">
                {totals.goingHeadcount}
                {event.capacity === null ? '' : ` of ${event.capacity}`}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">Flats going</dt>
              <dd className="text-body-strong">
                {totals.goingUnits} of {totals.audienceUnits} invited
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">Flats not going</dt>
              <dd className="text-body-strong">{totals.notGoingUnits}</dd>
            </div>
            {event.contributionType !== 'none' ? (
              <div>
                <dt className="text-caption text-ink-muted">
                  Contributions on bills
                </dt>
                <dd className="text-body-strong">
                  {formatEventMoney(totals.collectedPaise)}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
      <EventLifecycle detail={detail} actions={actions} />
      {event.status !== 'draft' ? <RsvpTable detail={detail} /> : null}
    </section>
  );
}
