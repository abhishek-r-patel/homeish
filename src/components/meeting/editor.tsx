// Create and edit meeting details, agenda and invitees, with an India-time notice preview.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxInput, RadioGroup } from '@/components/ui/choice-controls';
import { Card } from '@/components/ui/data-display';
import {
  DatePicker,
  TimePicker,
  type TimeParts,
} from '@/components/ui/date-time-inputs';
import { EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { noticeCheck } from '@/core/meeting/quorum';
import {
  MEETING_AGENDA_DESCRIPTION_MAX,
  MEETING_AGENDA_LIMIT,
  MEETING_AGENDA_TITLE_MAX,
  MEETING_DESCRIPTION_MAX,
  MEETING_ONLINE_URL_MAX,
  MEETING_TITLE_MAX,
  MEETING_TYPES,
  MEETING_VENUE_MAX,
  isUnitMeeting,
  meetingCreateInputSchema,
  meetingInputSchema,
  meetingUpdateInputSchema,
  meetingWriteResultSchema,
  type MeetingAdminDetail,
  type MeetingInviteeOptions,
  type MeetingSettings,
  type MeetingType,
} from '@/core/meeting/validation';
import {
  MEETING_LINK_CLASS,
  MEETING_TYPE_NAMES,
  NoticeWarning,
} from './shared';

type AgendaDraft = { key: string; title: string; description: string };

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

function MeetingDateTimePicker({
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

function requiredNoticeDays(settings: MeetingSettings, type: MeetingType) {
  return type === 'agm'
    ? settings.notice_days_agm
    : type === 'sgm'
      ? settings.notice_days_sgm
      : settings.notice_days_committee;
}

function AgendaEditor({
  items,
  onChange,
}: {
  items: AgendaDraft[];
  onChange: (items: AgendaDraft[]) => void;
}) {
  const id = useId();
  function update(index: number, patch: Partial<AgendaDraft>) {
    onChange(
      items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );
  }
  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }
  return (
    <fieldset className="grid min-w-0 gap-space-3">
      <legend className="text-body-strong">Agenda</legend>
      {items.length === 0 ? (
        <p className="text-caption text-ink-muted">No agenda items yet.</p>
      ) : (
        <ol className="grid gap-space-4">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
            >
              <TextInput
                id={`${id}-${item.key}-title`}
                label={`Agenda item ${index + 1} title`}
                value={item.title}
                maxLength={MEETING_AGENDA_TITLE_MAX}
                onChange={(event) =>
                  update(index, { title: event.currentTarget.value })
                }
              />
              <TextAreaInput
                id={`${id}-${item.key}-description`}
                label={`Agenda item ${index + 1} details (optional)`}
                value={item.description}
                maxLength={MEETING_AGENDA_DESCRIPTION_MAX}
                rows={2}
                onChange={(event) =>
                  update(index, { description: event.currentTarget.value })
                }
              />
              <div className="flex flex-wrap gap-space-2">
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Move item {index + 1} up
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Move item {index + 1} down
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() =>
                    onChange(items.filter((_, position) => position !== index))
                  }
                >
                  Remove item {index + 1}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={items.length >= MEETING_AGENDA_LIMIT}
        onClick={() =>
          onChange([
            ...items,
            { key: crypto.randomUUID(), title: '', description: '' },
          ])
        }
      >
        Add agenda item
      </Button>
    </fieldset>
  );
}

function UnitInviteePicker({
  units,
  selected,
  onChange,
}: {
  units: MeetingInviteeOptions['units'];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const id = useId();
  const blocks = useMemo(() => {
    const map = new Map<string, { name: string; unitIds: string[] }>();
    for (const unit of units) {
      const key = unit.blockId ?? 'none';
      const entry = map.get(key) ?? {
        name: unit.blockName ?? 'No block',
        unitIds: [],
      };
      entry.unitIds.push(unit.unitId);
      map.set(key, entry);
    }
    return [...map.entries()];
  }, [units]);
  const floors = useMemo(
    () =>
      [
        ...new Set(
          units.flatMap((unit) => (unit.floor === null ? [] : [unit.floor])),
        ),
      ].sort((a, b) => a - b),
    [units],
  );
  const [floor, setFloor] = useState('');
  function add(unitIds: string[]) {
    onChange(new Set([...selected, ...unitIds]));
  }
  function toggle(unitId: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(unitId);
    else next.delete(unitId);
    onChange(next);
  }
  if (units.length === 0) {
    return (
      <EmptyState
        title="No active units"
        description="Add units in Society setup before choosing invitees."
      />
    );
  }
  return (
    <div className="grid min-w-0 gap-space-3">
      <p role="status" className="text-body-strong">
        {selected.size} of {units.length} units selected
      </p>
      <div className="flex flex-wrap gap-space-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => add(units.map((unit) => unit.unitId))}
        >
          Select all units
        </Button>
        <Button
          type="button"
          variant="tertiary"
          onClick={() => onChange(new Set())}
        >
          Clear selection
        </Button>
      </div>
      <div className="flex flex-wrap gap-space-2">
        {blocks.map(([key, block]) => (
          <Button
            key={key}
            type="button"
            variant="tertiary"
            onClick={() => add(block.unitIds)}
          >
            Add all in {block.name}
          </Button>
        ))}
      </div>
      {floors.length ? (
        <div className="flex flex-wrap items-end gap-space-2">
          <SelectInput
            id={`${id}-floor`}
            label="Floor"
            value={floor}
            placeholder="Choose a floor"
            options={floors.map((value) => ({
              value: String(value),
              label: `Floor ${value}`,
            }))}
            onChange={(event) => setFloor(event.currentTarget.value)}
          />
          <Button
            type="button"
            variant="tertiary"
            disabled={floor === ''}
            onClick={() =>
              add(
                units
                  .filter((unit) => String(unit.floor) === floor)
                  .map((unit) => unit.unitId),
              )
            }
          >
            Add this floor
          </Button>
        </div>
      ) : null}
      <div className="grid max-h-96 min-w-0 gap-space-1 overflow-y-auto rounded-md border border-rule p-space-3">
        {units.map((unit) => (
          <CheckboxInput
            key={unit.unitId}
            id={`${id}-${unit.unitId}`}
            label={unit.label}
            description={
              [
                unit.blockName,
                unit.floor === null ? null : `Floor ${unit.floor}`,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            checked={selected.has(unit.unitId)}
            onChange={(event) =>
              toggle(unit.unitId, event.currentTarget.checked)
            }
          />
        ))}
      </div>
    </div>
  );
}

function MemberInviteePicker({
  members,
  selected,
  onChange,
}: {
  members: MeetingInviteeOptions['members'];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const id = useId();
  if (members.length === 0) {
    return (
      <EmptyState
        title="No committee members"
        description="Give members the committee role before choosing invitees."
      />
    );
  }
  return (
    <div className="grid min-w-0 gap-space-2">
      <p role="status" className="text-body-strong">
        {selected.size} of {members.length} committee members selected
      </p>
      {members.map((member) => (
        <CheckboxInput
          key={member.membershipId}
          id={`${id}-${member.membershipId}`}
          label={member.name}
          checked={selected.has(member.membershipId)}
          onChange={(event) => {
            const next = new Set(selected);
            if (event.currentTarget.checked) next.add(member.membershipId);
            else next.delete(member.membershipId);
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

export function MeetingEditor({
  detail,
  options,
  settings,
  action,
  now,
}: {
  detail: MeetingAdminDetail | null;
  options: MeetingInviteeOptions;
  settings: MeetingSettings;
  action: ModuleFormAction;
  now: string;
}) {
  const router = useRouter();
  const id = useId();
  const meeting = detail?.meeting ?? null;
  const editable =
    !meeting || meeting.status === 'draft' || meeting.status === 'scheduled';
  const [meetingType, setMeetingType] = useState<MeetingType>(
    meeting?.meetingType ?? 'agm',
  );
  const [title, setTitle] = useState(meeting?.title ?? '');
  const [description, setDescription] = useState(meeting?.description ?? '');
  const [startsAt, setStartsAt] = useState<string | null>(
    meeting?.startsAt ?? null,
  );
  const [endsAt, setEndsAt] = useState<string | null>(meeting?.endsAt ?? null);
  const [venue, setVenue] = useState(meeting?.venue ?? '');
  const [onlineUrl, setOnlineUrl] = useState(meeting?.onlineUrl ?? '');
  const [agenda, setAgenda] = useState<AgendaDraft[]>(
    (detail?.agenda ?? []).map((item) => ({
      key: item.id,
      title: item.title,
      description: item.description ?? '',
    })),
  );
  const [scope, setScope] = useState<'default' | 'custom'>(
    detail?.invitees.scope ?? 'default',
  );
  const [unitIds, setUnitIds] = useState(
    () => new Set(detail?.invitees.unitIds ?? []),
  );
  const [membershipIds, setMembershipIds] = useState(
    () => new Set(detail?.invitees.membershipIds ?? []),
  );
  const unitMeeting = isUnitMeeting(meetingType);
  const typeLocked = meeting !== null && meeting.status !== 'draft';
  const notice =
    startsAt && (!meeting || meeting.status !== 'held')
      ? noticeCheck(now, startsAt, requiredNoticeDays(settings, meetingType))
      : null;

  function buildMeeting() {
    return meetingInputSchema.parse({
      meetingType,
      title,
      description: description || null,
      startsAt,
      endsAt,
      venue: venue || null,
      onlineUrl: onlineUrl || null,
      agenda: agenda.map((item) => ({
        title: item.title,
        description: item.description || null,
      })),
      invitees:
        scope === 'default'
          ? { scope }
          : unitMeeting
            ? { scope, unitIds: [...unitIds] }
            : { scope, membershipIds: [...membershipIds] },
    });
  }

  if (!editable) {
    return (
      <EmptyState
        title="This meeting can no longer be edited"
        description="Held and cancelled meetings keep their details as recorded."
        action={
          meeting ? (
            <Link
              className={MEETING_LINK_CLASS}
              href={`/admin/meetings/${meeting.id}`}
            >
              Back to the meeting
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="grid min-w-0 gap-space-4">
      <Link
        className={MEETING_LINK_CLASS}
        href={meeting ? `/admin/meetings/${meeting.id}` : '/admin/meetings'}
      >
        {meeting ? 'Back to the meeting' : 'Back to Meetings'}
      </Link>
      <h1 className="text-title font-semibold">
        {meeting ? 'Edit meeting' : 'New meeting'}
      </h1>
      {meeting?.status === 'scheduled' ? (
        <p className="text-body text-ink-muted">
          This meeting is scheduled. Changing the time, venue or online link
          notifies invitees again.
        </p>
      ) : (
        <p className="text-body text-ink-muted">
          Save a draft now and finish it later. Invitees are only notified when
          you schedule it.
        </p>
      )}
      <ModuleActionForm
        action={action}
        submitLabel={meeting ? 'Save changes' : 'Save draft'}
        idempotent={!meeting}
        input={(_form, clientRequestId) =>
          meeting
            ? meetingUpdateInputSchema.parse({
                meetingId: meeting.id,
                expectedVersion: meeting.version,
                meeting: buildMeeting(),
              })
            : meetingCreateInputSchema.parse({
                clientRequestId,
                meeting: buildMeeting(),
              })
        }
        onSaved={(result) => {
          const parsed = meetingWriteResultSchema.safeParse(result);
          if (parsed.success)
            router.push(`/admin/meetings/${parsed.data.meetingId}`);
        }}
      >
        <Card title="Details">
          <div className="grid min-w-0 gap-space-4">
            <SelectInput
              id={`${id}-type`}
              label="Meeting type"
              value={meetingType}
              disabled={typeLocked}
              helpText={
                typeLocked
                  ? 'The type is fixed once the meeting is scheduled.'
                  : undefined
              }
              options={MEETING_TYPES.map((value) => ({
                value,
                label: MEETING_TYPE_NAMES[value],
              }))}
              onChange={(event) => {
                const next = MEETING_TYPES.find(
                  (value) => value === event.currentTarget.value,
                );
                if (next) setMeetingType(next);
              }}
            />
            <TextInput
              id={`${id}-title`}
              label="Meeting title"
              value={title}
              maxLength={MEETING_TITLE_MAX}
              required
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
            <TextAreaInput
              id={`${id}-description`}
              label="Description (optional)"
              value={description}
              maxLength={MEETING_DESCRIPTION_MAX}
              rows={4}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </div>
        </Card>
        <Card
          title="When and where"
          description="All times are India time (IST)."
        >
          <div className="grid min-w-0 gap-space-4">
            <MeetingDateTimePicker
              id={`${id}-starts`}
              label="Starts"
              value={startsAt}
              onChange={setStartsAt}
            />
            <MeetingDateTimePicker
              id={`${id}-ends`}
              label="Ends"
              value={endsAt}
              onChange={setEndsAt}
            />
            {notice ? (
              <NoticeWarning
                requiredDays={notice.requiredDays}
                givenDays={notice.givenDays}
              />
            ) : null}
            <TextInput
              id={`${id}-venue`}
              label="Venue (optional)"
              value={venue}
              maxLength={MEETING_VENUE_MAX}
              onChange={(event) => setVenue(event.currentTarget.value)}
            />
            <TextInput
              id={`${id}-online`}
              label="Online meeting link (optional)"
              type="url"
              inputMode="url"
              value={onlineUrl}
              maxLength={MEETING_ONLINE_URL_MAX}
              helpText="Use a secure link that starts with https://."
              onChange={(event) => setOnlineUrl(event.currentTarget.value)}
            />
          </div>
        </Card>
        <Card title="Agenda">
          <AgendaEditor items={agenda} onChange={setAgenda} />
        </Card>
        <Card
          title="Invitees"
          description={
            unitMeeting
              ? 'By default every active unit is invited.'
              : 'By default every committee member is invited.'
          }
        >
          <div className="grid min-w-0 gap-space-4">
            <RadioGroup
              id={`${id}-scope`}
              label="Who is invited"
              name={`${id}-scope`}
              value={scope}
              onChange={(value) =>
                setScope(value === 'custom' ? 'custom' : 'default')
              }
              options={[
                {
                  value: 'default',
                  label: unitMeeting
                    ? 'Every active unit'
                    : 'Every committee member',
                },
                {
                  value: 'custom',
                  label: unitMeeting
                    ? 'Chosen units'
                    : 'Chosen committee members',
                },
              ]}
            />
            {scope === 'custom' ? (
              unitMeeting ? (
                <UnitInviteePicker
                  units={options.units}
                  selected={unitIds}
                  onChange={setUnitIds}
                />
              ) : (
                <MemberInviteePicker
                  members={options.members}
                  selected={membershipIds}
                  onChange={setMembershipIds}
                />
              )
            ) : null}
          </div>
        </Card>
      </ModuleActionForm>
    </section>
  );
}
