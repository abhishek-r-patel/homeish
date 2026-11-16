// Create and edit an event's details, limits, contribution and audience, entered in India time.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { CheckboxInput, RadioGroup } from '@/components/ui/choice-controls';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import {
  DatePicker,
  TimePicker,
  type TimeParts,
} from '@/components/ui/date-time-inputs';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { ValidationError } from '@/core/errors';
import { paiseFromRupeeText } from '@/core/event/pricing';
import {
  EVENT_CAPACITY_MAX,
  EVENT_DESCRIPTION_MAX,
  EVENT_HEADCOUNT_MAX,
  EVENT_TITLE_MAX,
  EVENT_VENUE_MAX,
  eventCreateInputSchema,
  eventInputSchema,
  eventUpdateInputSchema,
  eventWriteResultSchema,
  type EventAdminDetail,
  type EventBlockOption,
  type EventContributionTypeValue,
} from '@/core/event/validation';
import { rupeesFromPaise } from '@/lib/money';
import { EVENT_LINK_CLASS, describeContribution } from './shared';

const CONTRIBUTION_OPTIONS = [
  { value: 'none', label: 'Free', description: 'No charge on any bill.' },
  {
    value: 'per_unit',
    label: 'Per flat',
    description: 'A fixed amount on the bill of each flat that is going.',
  },
  {
    value: 'per_head',
    label: 'Per person',
    description: 'The amount times the number of people going from the flat.',
  },
] as const;

function timeParts(value: string | null): { date: string; time: TimeParts } {
  if (!value) {
    return { date: '', time: { hour: '6', minute: '00', period: 'PM' } };
  }
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).formatToParts(new Date(value));
  const dateValues = Object.fromEntries(
    dateParts.map(({ type, value: part }) => [type, part]),
  );
  const clockParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).formatToParts(new Date(value));
  const clockValues = Object.fromEntries(
    clockParts.map(({ type, value: part }) => [type, part]),
  );
  const period = clockValues.dayPeriod?.toUpperCase();
  return {
    date: `${dateValues.year}-${dateValues.month}-${dateValues.day}`,
    time: {
      hour: clockValues.hour ?? '12',
      minute: clockValues.minute ?? '00',
      period: period === 'PM' ? 'PM' : 'AM',
    },
  };
}

function combineIstDateTime(date: string, time: TimeParts) {
  if (!date) return null;
  const hour24 = (Number(time.hour) % 12) + (time.period === 'PM' ? 12 : 0);
  const hour = String(hour24).padStart(2, '0');
  const parsed = new Date(`${date}T${hour}:${time.minute}:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function EventDateTimePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const initial = timeParts(value);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  return (
    <div className="grid gap-space-2">
      <DatePicker
        id={`${id}-date`}
        label={`${label} date`}
        value={date}
        onChange={(next) => {
          setDate(next);
          onChange(combineIstDateTime(next, time));
        }}
      />
      <TimePicker
        id={`${id}-time`}
        label={`${label} time`}
        value={time}
        onChange={(next) => {
          setTime(next);
          onChange(combineIstDateTime(date, next));
        }}
        timeZone="Asia/Kolkata (IST)"
      />
    </div>
  );
}

// Blank means "no limit"; anything else must be a whole number the schema can range-check.
function optionalWholeNumber(value: string, field: string, message: string) {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) throw new ValidationError({ [field]: message });
  return Number(text);
}

export function EventEditor({
  detail,
  blocks,
  billingEnabled,
  action,
}: {
  detail: EventAdminDetail | null;
  blocks: readonly EventBlockOption[];
  billingEnabled: boolean;
  action: ModuleFormAction;
}) {
  const router = useRouter();
  const id = useId();
  const event = detail?.event ?? null;
  const editable =
    !event ||
    event.status === 'draft' ||
    (event.status === 'published' && !event.past);
  const contributionLocked = event !== null && event.status !== 'draft';
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [venue, setVenue] = useState(event?.venue ?? '');
  const [startsAt, setStartsAt] = useState<string | null>(
    event?.startsAt ?? null,
  );
  const [endsAt, setEndsAt] = useState<string | null>(event?.endsAt ?? null);
  const [hasDeadline, setHasDeadline] = useState(
    event?.rsvpDeadline !== null && event?.rsvpDeadline !== undefined,
  );
  const [rsvpDeadline, setRsvpDeadline] = useState<string | null>(
    event?.rsvpDeadline ?? null,
  );
  const [capacity, setCapacity] = useState(
    event?.capacity === null || event?.capacity === undefined
      ? ''
      : String(event.capacity),
  );
  const [maxPerUnit, setMaxPerUnit] = useState(
    event?.maxPerUnit === null || event?.maxPerUnit === undefined
      ? ''
      : String(event.maxPerUnit),
  );
  const [contributionType, setContributionType] =
    useState<EventContributionTypeValue>(event?.contributionType ?? 'none');
  const [amount, setAmount] = useState(
    event && event.contributionPaise > 0
      ? rupeesFromPaise(event.contributionPaise)
      : '',
  );
  const [scope, setScope] = useState<'all' | 'blocks'>(
    event?.audience.scope ?? 'all',
  );
  const [blockIds, setBlockIds] = useState(
    () => new Set(event?.audience.blockIds ?? []),
  );

  function contributionPaise() {
    if (contributionLocked && event) return event.contributionPaise;
    if (contributionType === 'none') return 0;
    const paise = paiseFromRupeeText(amount);
    if (paise === null) {
      throw new ValidationError({
        contributionPaise:
          'Enter the contribution in rupees, like 250 or 250.50.',
      });
    }
    return paise;
  }

  function buildEvent() {
    return eventInputSchema.parse({
      title,
      description: description || null,
      venue: venue || null,
      startsAt,
      endsAt,
      rsvpDeadline: hasDeadline ? rsvpDeadline : null,
      capacity: optionalWholeNumber(
        capacity,
        'capacity',
        'Enter capacity as a whole number, or leave it blank for no limit.',
      ),
      maxPerUnit: optionalWholeNumber(
        maxPerUnit,
        'maxPerUnit',
        'Enter the limit per flat as a whole number, or leave it blank.',
      ),
      contributionType:
        contributionLocked && event ? event.contributionType : contributionType,
      contributionPaise: contributionPaise(),
      audience:
        scope === 'all' ? { scope } : { scope, blockIds: [...blockIds] },
    });
  }

  if (!editable) {
    return (
      <EmptyState
        title="This event can no longer be edited"
        description="Cancelled and finished events keep their details as recorded."
        action={
          event ? (
            <Link
              className={EVENT_LINK_CLASS}
              href={`/admin/events/${event.id}`}
            >
              Back to the event
            </Link>
          ) : undefined
        }
      />
    );
  }

  const chargesSomething =
    (contributionLocked && event
      ? event.contributionType
      : contributionType) !== 'none';

  return (
    <section className="grid min-w-0 gap-space-4">
      <Link
        className={EVENT_LINK_CLASS}
        href={event ? `/admin/events/${event.id}` : '/admin/events'}
      >
        {event ? 'Back to the event' : 'Back to Events'}
      </Link>
      <h1 className="text-title font-semibold">
        {event ? 'Edit event' : 'New event'}
      </h1>
      {event?.status === 'published' ? (
        <p className="text-body text-ink-muted">
          This event is published. Changing the start, end or venue notifies the
          invited homes again.
        </p>
      ) : (
        <p className="text-body text-ink-muted">
          Save a draft now and finish it later. Residents are only notified when
          you publish it.
        </p>
      )}
      {chargesSomething && !billingEnabled ? (
        <Banner title="Billing is turned off" tone="warning">
          You can save this draft, but an event with a contribution cannot be
          published until Billing is turned on.
        </Banner>
      ) : null}
      <ModuleActionForm
        action={action}
        submitLabel={event ? 'Save Changes' : 'Save Draft'}
        idempotent={!event}
        input={(_form, clientRequestId) =>
          event
            ? eventUpdateInputSchema.parse({
                eventId: event.id,
                expectedVersion: event.version,
                event: buildEvent(),
              })
            : eventCreateInputSchema.parse({
                clientRequestId,
                event: buildEvent(),
              })
        }
        onSaved={(result) => {
          const parsed = eventWriteResultSchema.safeParse(result);
          if (parsed.success)
            router.push(`/admin/events/${parsed.data.eventId}`);
        }}
      >
        <Card title="Details">
          <div className="grid min-w-0 gap-space-4">
            <TextInput
              id={`${id}-title`}
              label="Event title"
              value={title}
              maxLength={EVENT_TITLE_MAX}
              required
              onChange={(change) => setTitle(change.currentTarget.value)}
            />
            <TextAreaInput
              id={`${id}-description`}
              label="Description (optional)"
              value={description}
              maxLength={EVENT_DESCRIPTION_MAX}
              rows={4}
              onChange={(change) => setDescription(change.currentTarget.value)}
            />
          </div>
        </Card>
        <Card
          title="When and where"
          description="All times are India time (IST)."
        >
          <div className="grid min-w-0 gap-space-4">
            <EventDateTimePicker
              id={`${id}-starts`}
              label="Starts"
              value={startsAt}
              onChange={setStartsAt}
            />
            <EventDateTimePicker
              id={`${id}-ends`}
              label="Ends"
              value={endsAt}
              onChange={setEndsAt}
            />
            <TextInput
              id={`${id}-venue`}
              label="Venue (optional)"
              value={venue}
              maxLength={EVENT_VENUE_MAX}
              onChange={(change) => setVenue(change.currentTarget.value)}
            />
          </div>
        </Card>
        <Card
          title="RSVPs and limits"
          description="Leave a limit blank for no limit."
        >
          <div className="grid min-w-0 gap-space-4">
            <CheckboxInput
              id={`${id}-has-deadline`}
              label="Close RSVPs before the event starts"
              description="Without a deadline, RSVPs close when the event starts."
              checked={hasDeadline}
              onChange={(change) =>
                setHasDeadline(change.currentTarget.checked)
              }
            />
            {hasDeadline ? (
              <EventDateTimePicker
                id={`${id}-deadline`}
                label="RSVP deadline"
                value={rsvpDeadline}
                onChange={setRsvpDeadline}
              />
            ) : null}
            <TextInput
              id={`${id}-capacity`}
              label="Capacity in people (optional)"
              inputMode="numeric"
              value={capacity}
              maxLength={String(EVENT_CAPACITY_MAX).length}
              helpText="RSVPs are refused once this many people are going."
              onChange={(change) => setCapacity(change.currentTarget.value)}
            />
            <TextInput
              id={`${id}-max-per-unit`}
              label="Most people per flat (optional)"
              inputMode="numeric"
              value={maxPerUnit}
              maxLength={String(EVENT_HEADCOUNT_MAX).length}
              onChange={(change) => setMaxPerUnit(change.currentTarget.value)}
            />
          </div>
        </Card>
        <Card
          title="Contribution"
          description="Contributions are added to the flat's maintenance bill when it RSVPs going."
        >
          {contributionLocked && event ? (
            <div className="grid gap-space-2">
              <p className="text-body-strong">
                {describeContribution(
                  event.contributionType,
                  event.contributionPaise,
                )}
              </p>
              <p className="text-caption text-ink-muted">
                The contribution cannot be changed after the event is published.
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-space-4">
              <RadioGroup
                id={`${id}-contribution-type`}
                name="contributionType"
                label="How is the contribution charged?"
                value={contributionType}
                options={CONTRIBUTION_OPTIONS}
                onChange={(value) => {
                  const next = CONTRIBUTION_OPTIONS.find(
                    (option) => option.value === value,
                  );
                  if (next) setContributionType(next.value);
                }}
              />
              {contributionType !== 'none' ? (
                <AmountInput
                  id={`${id}-amount`}
                  label={
                    contributionType === 'per_unit'
                      ? 'Amount per flat'
                      : 'Amount per person'
                  }
                  value={amount}
                  required
                  helpText="Up to ₹1,00,000. It cannot be changed after publishing."
                  onChange={(change) => setAmount(change.currentTarget.value)}
                />
              ) : null}
            </div>
          )}
        </Card>
        <Card title="Who is invited">
          <div className="grid min-w-0 gap-space-4">
            <RadioGroup
              id={`${id}-audience`}
              name="audienceScope"
              label="Invite"
              value={scope}
              options={[
                { value: 'all', label: 'Every flat in the society' },
                {
                  value: 'blocks',
                  label: 'Only flats in chosen blocks',
                },
              ]}
              onChange={(value) =>
                setScope(value === 'blocks' ? 'blocks' : 'all')
              }
            />
            {scope === 'blocks' ? (
              blocks.length === 0 ? (
                <EmptyState
                  title="No active blocks"
                  description="Add blocks in Society setup, or invite every flat."
                />
              ) : (
                <fieldset className="grid min-w-0 gap-space-2">
                  <legend className="text-body-strong">Blocks</legend>
                  <p role="status" className="text-caption text-ink-muted">
                    {blockIds.size} of {blocks.length} blocks chosen
                  </p>
                  {blocks.map((block) => (
                    <CheckboxInput
                      key={block.blockId}
                      id={`${id}-block-${block.blockId}`}
                      label={block.name}
                      checked={blockIds.has(block.blockId)}
                      onChange={(change) => {
                        const next = new Set(blockIds);
                        if (change.currentTarget.checked)
                          next.add(block.blockId);
                        else next.delete(block.blockId);
                        setBlockIds(next);
                      }}
                    />
                  ))}
                </fieldset>
              )
            ) : null}
          </div>
        </Card>
      </ModuleActionForm>
    </section>
  );
}
