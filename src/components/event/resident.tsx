// Render resident event lists, event details and the per-flat RSVP form with a contribution preview.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { RadioGroup } from '@/components/ui/choice-controls';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { rsvpChargePreview } from '@/core/event/pricing';
import { memberRsvpStatus, memberRsvpSummary } from '@/core/event/summary';
import {
  EVENT_HEADCOUNT_MAX,
  eventRsvpInputSchema,
  type EventMemberDetail,
  type EventMemberFilter,
  type EventMemberList,
  type EventMemberUnit,
  type EventRsvpStatus,
} from '@/core/event/validation';
import {
  EVENT_LINK_CLASS,
  EventRsvpChip,
  EventStatusChip,
  describeContribution,
  formatEventDateTime,
  formatEventMoney,
} from './shared';

const FILTER_LABELS: Readonly<Record<EventMemberFilter, string>> = {
  upcoming: 'Upcoming',
  past: 'Past',
};

function listStatus(item: EventMemberList['items'][number]) {
  if (item.status === 'cancelled') return 'event.cancelled' as const;
  const status = memberRsvpStatus(item.myRsvps);
  if (status === 'going') return 'event_rsvp.going' as const;
  if (status === 'not_going') return 'event_rsvp.not_going' as const;
  return undefined;
}

export function ResidentEventListView({
  list,
  filter,
  basePath = '/events',
}: {
  list: EventMemberList;
  filter: EventMemberFilter;
  basePath?: string;
}) {
  return (
    <section className="grid min-w-0 gap-space-5">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">Events</h1>
        <p className="text-body text-ink-muted">
          Society events open to your home. Tell the organisers who is coming.
          All times are India time (IST).
        </p>
      </div>
      <nav aria-label="Event lists" className="flex flex-wrap gap-space-4">
        {(Object.keys(FILTER_LABELS) as EventMemberFilter[]).map((value) => (
          <Link
            key={value}
            className={EVENT_LINK_CLASS}
            href={value === 'upcoming' ? basePath : `${basePath}?view=${value}`}
            aria-current={filter === value ? 'page' : undefined}
          >
            {FILTER_LABELS[value]}
          </Link>
        ))}
      </nav>
      {list.items.length === 0 ? (
        <EmptyState
          title={filter === 'past' ? 'No past events' : 'No upcoming events'}
          description={
            filter === 'past'
              ? 'Events that have ended or were cancelled will appear here.'
              : 'You will be notified when a new event is announced.'
          }
        />
      ) : (
        <ul className="grid gap-space-2">
          {list.items.map((item) => (
            <li key={item.id}>
              <ListItem
                href={`/events/${item.id}`}
                title={<span className="break-words">{item.title}</span>}
                secondary={
                  <span className="break-words">
                    {formatEventDateTime(item.startsAt)} IST
                    {item.venue ? ` · ${item.venue}` : ''} ·{' '}
                    {describeContribution(
                      item.contributionType,
                      item.contributionPaise,
                    )}{' '}
                    · {memberRsvpSummary(item)}
                  </span>
                }
                status={listStatus(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContributionPreview({
  event,
  currentChargePaise,
  status,
  headcount,
}: {
  event: EventMemberDetail['event'];
  currentChargePaise: number;
  status: EventRsvpStatus;
  headcount: number;
}) {
  if (event.contributionType === 'none') return null;
  const { chargePaise, changePaise } = rsvpChargePreview(
    event.contributionType,
    event.contributionPaise,
    currentChargePaise,
    { status, headcount },
  );
  if (changePaise > 0) {
    return (
      <p role="status" className="text-body text-ink">
        {formatEventMoney(changePaise)} will be added to your flat’s bill
        {currentChargePaise > 0
          ? ` (total ${formatEventMoney(chargePaise)} for this event).`
          : '.'}
      </p>
    );
  }
  if (changePaise < 0) {
    return (
      <p role="status" className="text-body text-ink">
        {formatEventMoney(-changePaise)} will be credited back to your flat’s
        bill.
      </p>
    );
  }
  return (
    <p role="status" className="text-body text-ink-muted">
      {chargePaise > 0
        ? `No change to the ${formatEventMoney(chargePaise)} already on your flat’s bill.`
        : 'Nothing will be added to your flat’s bill.'}
    </p>
  );
}

function UnitRsvpForm({
  detail,
  unit,
  action,
}: {
  detail: EventMemberDetail;
  unit: EventMemberUnit;
  action: ModuleFormAction;
}) {
  const id = useId();
  const { event } = detail;
  const [status, setStatus] = useState<EventRsvpStatus>(
    unit.rsvp?.status ?? 'going',
  );
  const [headcount, setHeadcount] = useState(
    String(unit.rsvp && unit.rsvp.headcount > 0 ? unit.rsvp.headcount : 1),
  );
  const parsedHeadcount = Number(headcount);
  const maxHeadcount = event.maxPerUnit ?? EVENT_HEADCOUNT_MAX;
  const validHeadcount =
    Number.isInteger(parsedHeadcount) &&
    parsedHeadcount >= 1 &&
    parsedHeadcount <= maxHeadcount;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={`Save RSVP for ${unit.label}`}
      input={() =>
        eventRsvpInputSchema.parse({
          eventId: event.id,
          unitId: unit.unitId,
          status,
          headcount: status === 'going' ? parsedHeadcount : 0,
          expectedVersion: unit.rsvp?.version ?? null,
        })
      }
    >
      <RadioGroup
        id={`${id}-status`}
        name={`${id}-status`}
        label={`Is ${unit.label} coming?`}
        value={status}
        onChange={(value) =>
          setStatus(value === 'not_going' ? 'not_going' : 'going')
        }
        options={[
          { value: 'going', label: 'Going' },
          { value: 'not_going', label: 'Not going' },
        ]}
      />
      {status === 'going' ? (
        <TextInput
          id={`${id}-headcount`}
          label="How many people are coming?"
          type="number"
          inputMode="numeric"
          min={1}
          max={maxHeadcount}
          step={1}
          required
          value={headcount}
          helpText={
            event.maxPerUnit
              ? `Up to ${event.maxPerUnit} per flat.`
              : 'Include everyone from your home who is coming.'
          }
          error={
            headcount !== '' && !validHeadcount
              ? `Enter a number from 1 to ${maxHeadcount}.`
              : undefined
          }
          onChange={(nextEvent) => setHeadcount(nextEvent.currentTarget.value)}
        />
      ) : null}
      <ContributionPreview
        event={event}
        currentChargePaise={unit.rsvp?.netChargePaise ?? 0}
        status={status}
        headcount={validHeadcount ? parsedHeadcount : 0}
      />
      {event.contributionType !== 'none' ? (
        <p className="text-caption text-ink-muted">
          If you change to not going before RSVPs close on{' '}
          {formatEventDateTime(event.rsvpClosesAt)} IST, the contribution is
          credited back in full. After that, it cannot be refunded unless the
          event is cancelled.
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

function UnitRsvp({
  detail,
  unit,
  action,
}: {
  detail: EventMemberDetail;
  unit: EventMemberUnit;
  action: ModuleFormAction;
}) {
  const { event } = detail;
  const current = unit.rsvp ? (
    <div className="flex flex-wrap items-center gap-space-2 text-body">
      <EventRsvpChip status={unit.rsvp.status} />
      {unit.rsvp.status === 'going' ? (
        <span>
          {unit.rsvp.headcount}{' '}
          {unit.rsvp.headcount === 1 ? 'person' : 'people'}
        </span>
      ) : null}
      {unit.rsvp.netChargePaise > 0 ? (
        <span className="text-ink-muted">
          · {formatEventMoney(unit.rsvp.netChargePaise)} on your bill
        </span>
      ) : null}
    </div>
  ) : (
    <p className="text-body text-ink-muted">No RSVP yet.</p>
  );
  let body;
  if (event.status === 'cancelled') {
    body = (
      <p className="text-body text-ink-muted">
        This event was cancelled. Any contribution was credited back to your
        flat’s bill.
      </p>
    );
  } else if (!event.rsvpOpen) {
    body = (
      <p className="text-body text-ink-muted">
        RSVPs closed on {formatEventDateTime(event.rsvpClosesAt)} IST.
      </p>
    );
  } else if (!unit.canRsvp) {
    body = (
      <p className="text-body text-ink-muted">
        You cannot RSVP for this flat. Only people currently living in it can.
      </p>
    );
  } else {
    body = <UnitRsvpForm detail={detail} unit={unit} action={action} />;
  }
  return (
    <li className="grid min-w-0 gap-space-3">
      <p className="text-body-strong break-words">Flat {unit.label}</p>
      {current}
      {body}
    </li>
  );
}

export function ResidentEventDetailView({
  detail,
  rsvpAction,
  backHref = '/events',
}: {
  detail: EventMemberDetail;
  rsvpAction: ModuleFormAction;
  backHref?: string;
}) {
  const { event } = detail;
  const hasContribution = event.contributionType !== 'none';
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
          {event.cancellationReason ?? 'No reason was given.'}
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
            <dt className="text-caption text-ink-muted">RSVPs close (IST)</dt>
            <dd>{formatEventDateTime(event.rsvpClosesAt)}</dd>
          </div>
        </dl>
        {event.description ? (
          <p className="mt-space-3 break-words whitespace-pre-line text-body">
            {event.description}
          </p>
        ) : null}
      </Card>
      <Card title="Places and contribution">
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">Places left</dt>
            <dd>
              {detail.spotsLeft === null
                ? 'No limit'
                : detail.spotsLeft === 0
                  ? 'Full'
                  : `${detail.spotsLeft} of ${event.capacity ?? detail.spotsLeft}`}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">People going</dt>
            <dd>{detail.goingHeadcount}</dd>
          </div>
          {event.maxPerUnit ? (
            <div>
              <dt className="text-caption text-ink-muted">Limit per flat</dt>
              <dd>
                {event.maxPerUnit}{' '}
                {event.maxPerUnit === 1 ? 'person' : 'people'}
              </dd>
            </div>
          ) : null}
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
        {hasContribution ? (
          <p className="mt-space-3 text-caption text-ink-muted">
            The contribution is added to your flat’s bill as soon as you RSVP
            going.
          </p>
        ) : null}
      </Card>
      {event.status === 'published' &&
      event.rsvpOpen &&
      detail.spotsLeft === 0 ? (
        <Banner title="This event is full" tone="warning">
          New RSVPs or larger groups cannot be accepted. You can still say you
          are not going.
        </Banner>
      ) : null}
      {hasContribution && !detail.billingEnabled && event.rsvpOpen ? (
        <Banner title="RSVPs are paused" tone="warning">
          This event has a contribution, but billing is turned off for your
          society. Ask the committee to turn it on before you RSVP going.
        </Banner>
      ) : null}
      <Card title="Your RSVP">
        {detail.myUnits.length === 0 ? (
          <p className="text-body text-ink-muted">
            None of your flats are invited to this event.
          </p>
        ) : (
          <ul className="grid gap-space-5">
            {detail.myUnits.map((unit) => (
              <UnitRsvp
                key={unit.unitId}
                detail={detail}
                unit={unit}
                action={rsvpAction}
              />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
