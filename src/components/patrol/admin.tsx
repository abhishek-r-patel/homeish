// Let administrators manage patrol checkpoints, schedules and incidents and review missed rounds; committee members read only.
'use client';
import { useId, useMemo, useState } from 'react';
import {
  PATROL_CATEGORY_LABELS,
  formatClockTime,
  formatInterval,
  formatPatrolClock,
  formatPatrolCode,
  formatPatrolTime,
} from '@/core/patrol/presentation';
import {
  computePatrolRounds,
  currentPatrolRounds,
  missedPatrolCheckpoints,
} from '@/core/patrol/rounds';
import {
  PATROL_PHOTO_RETENTION_MAX_DAYS,
  PATROL_PHOTO_RETENTION_MIN_DAYS,
  patrolCheckpointInputSchema,
  patrolIncidentCloseInputSchema,
  patrolIncidentNoteInputSchema,
  patrolScheduleInputSchema,
  patrolSettingsInputSchema,
  type PatrolAdminWorkspace,
  type PatrolCheckpoint,
  type PatrolSchedule,
} from '@/core/patrol/validation';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { Card } from '@/components/ui/data-display';
import { TimePicker, type TimeParts } from '@/components/ui/date-time-inputs';
import { Banner } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  PatrolHandoverItem,
  PatrolIncidentItem,
  PatrolRoundItem,
} from './records';
import {
  PATROL_ACTIONS,
  PatrolQuickAction,
  type PatrolActions,
} from './shared';

const HOUR = 3_600_000;
const MISSED_HOURS = 48;

function toParts(value: string): TimeParts {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return {
    hour: String(hours % 12 === 0 ? 12 : hours % 12),
    minute: String(minutes).padStart(2, '0'),
    period: hours >= 12 ? 'PM' : 'AM',
  };
}

function fromParts(parts: TimeParts) {
  const hour = (Number(parts.hour) % 12) + (parts.period === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${parts.minute.padStart(2, '0')}`;
}

const summaryClass =
  'min-h-12 cursor-pointer content-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus';

function CheckpointForm({
  checkpoint,
  actions,
}: {
  checkpoint: PatrolCheckpoint | null;
  actions: PatrolActions;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={actions.saveCheckpoint}
      idempotent
      submitLabel={checkpoint ? `Save ${checkpoint.name}` : 'Add checkpoint'}
      input={(form, clientRequestId) =>
        patrolCheckpointInputSchema.parse({
          checkpointId: checkpoint?.id ?? null,
          name: String(form.get('name') ?? ''),
          locationNote: String(form.get('locationNote') ?? ''),
          expectedVersion: checkpoint?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-name`}
        name="name"
        label="Checkpoint name"
        helpText="For example Main gate, Tower B terrace or Pump room."
        required
        maxLength={80}
        defaultValue={checkpoint?.name}
        autoComplete="off"
      />
      <TextInput
        id={`${id}-location`}
        name="locationNote"
        label="Where the sticker is (optional)"
        maxLength={200}
        defaultValue={checkpoint?.location_note ?? ''}
        autoComplete="off"
      />
      {checkpoint ? null : (
        <p className="text-caption text-ink-muted">
          A 6-character code is created automatically and printed under the QR
          code.
        </p>
      )}
    </ModuleActionForm>
  );
}

function ScheduleForm({
  schedule,
  checkpoints,
  actions,
}: {
  schedule: PatrolSchedule | null;
  checkpoints: readonly PatrolCheckpoint[];
  actions: PatrolActions;
}) {
  const id = useId();
  const [start, setStart] = useState<TimeParts>(
    toParts(schedule?.shift_start ?? '22:00'),
  );
  const [end, setEnd] = useState<TimeParts>(
    toParts(schedule?.shift_end ?? '06:00'),
  );
  const interval = schedule?.interval_minutes ?? 120;
  const inHours = interval % 60 === 0;
  const included = new Set(
    schedule?.checkpoints.map((link) => link.checkpoint_id) ?? [],
  );
  return (
    <ModuleActionForm
      action={actions.saveSchedule}
      idempotent
      submitLabel={schedule ? `Save ${schedule.name}` : 'Add schedule'}
      input={(form, clientRequestId) =>
        patrolScheduleInputSchema.parse({
          scheduleId: schedule?.id ?? null,
          name: String(form.get('name') ?? ''),
          shiftStart: fromParts(start),
          shiftEnd: fromParts(end),
          intervalMinutes:
            Number(form.get('interval')) *
            (form.get('intervalUnit') === 'hours' ? 60 : 1),
          graceMinutes: Number(form.get('grace')),
          checkpointIds: form.getAll('checkpointIds').map(String),
          expectedVersion: schedule?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-name`}
        name="name"
        label="Schedule name"
        helpText="For example Night shift."
        required
        maxLength={80}
        defaultValue={schedule?.name}
        autoComplete="off"
      />
      <TimePicker
        id={`${id}-start`}
        label="Shift starts"
        required
        value={start}
        onChange={setStart}
      />
      <TimePicker
        id={`${id}-end`}
        label="Shift ends"
        helpText="An end time before the start runs past midnight."
        required
        value={end}
        onChange={setEnd}
      />
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          id={`${id}-interval`}
          name="interval"
          type="number"
          inputMode="numeric"
          label="A round every"
          required
          min={1}
          max={720}
          defaultValue={inHours ? interval / 60 : interval}
        />
        <SelectInput
          id={`${id}-unit`}
          name="intervalUnit"
          label="Unit"
          defaultValue={inHours ? 'hours' : 'minutes'}
          options={[
            { value: 'hours', label: 'Hours' },
            { value: 'minutes', label: 'Minutes' },
          ]}
        />
      </div>
      <TextInput
        id={`${id}-grace`}
        name="grace"
        type="number"
        inputMode="numeric"
        label="Grace period (minutes)"
        helpText="Extra time after a round ends before a checkpoint counts as missed."
        required
        min={0}
        max={120}
        defaultValue={schedule?.grace_minutes ?? 15}
      />
      <fieldset className="grid gap-space-1 border-0 p-0">
        <legend className="text-body-strong">Checkpoints in each round</legend>
        {checkpoints.length === 0 ? (
          <p className="text-caption text-ink-muted">
            Add an active checkpoint first.
          </p>
        ) : (
          checkpoints.map((checkpoint) => (
            <CheckboxInput
              key={checkpoint.id}
              id={`${id}-checkpoint-${checkpoint.id}`}
              name="checkpointIds"
              value={checkpoint.id}
              label={checkpoint.name}
              defaultChecked={schedule ? included.has(checkpoint.id) : true}
            />
          ))
        )}
      </fieldset>
    </ModuleActionForm>
  );
}

export function PatrolAdminView({
  workspace,
  actions = PATROL_ACTIONS,
  fileRequest,
}: {
  workspace: PatrolAdminWorkspace;
  actions?: PatrolActions;
  fileRequest?: typeof fetch;
}) {
  const id = useId();
  const timeZone = workspace.timezone;
  const manage = workspace.can_manage;
  const now = useMemo(
    () => new Date(workspace.generated_at),
    [workspace.generated_at],
  );
  const names = useMemo(
    () =>
      new Map(
        workspace.checkpoints.map((checkpoint) => [
          checkpoint.id,
          checkpoint.name,
        ]),
      ),
    [workspace.checkpoints],
  );
  const active = workspace.checkpoints.filter(
    (checkpoint) => checkpoint.active,
  );
  const inactive = workspace.checkpoints.filter(
    (checkpoint) => !checkpoint.active,
  );
  const rounds = useMemo(() => {
    const horizon = now.getTime() - MISSED_HOURS * HOUR;
    return computePatrolRounds({
      timeZone,
      schedules: workspace.schedules,
      scans: workspace.scans,
      activeCheckpointIds: new Set(
        workspace.checkpoints
          .filter((checkpoint) => checkpoint.active)
          .map((checkpoint) => checkpoint.id),
      ),
      now,
      from: new Date(horizon),
      until: now,
    }).filter((round) => round.start.getTime() >= horizon);
  }, [
    timeZone,
    workspace.schedules,
    workspace.scans,
    workspace.checkpoints,
    now,
  ]);
  const missed = missedPatrolCheckpoints(rounds);
  const current = currentPatrolRounds(rounds, now);
  const openIncidents = workspace.incidents.filter(
    (incident) => incident.status === 'open',
  );

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Guard patrol</h1>
      {manage ? null : (
        <Banner tone="neutral" title="View only">
          Only administrators can change checkpoints, schedules, incidents and
          settings.
        </Banner>
      )}

      <Card
        title="Missed checkpoints"
        description={`Checkpoints not scanned within their round and grace period in the last ${MISSED_HOURS} hours.`}
      >
        {missed.length === 0 ? (
          <p className="text-body text-ink-muted">
            {workspace.schedules.some((schedule) => schedule.active)
              ? 'No missed checkpoints.'
              : 'No active schedule. Add a schedule to track rounds.'}
          </p>
        ) : (
          <ul className="grid gap-space-2">
            {missed.map((item) => (
              <li
                key={`${item.scheduleId}-${item.checkpointId}-${item.windowStart.toISOString()}`}
                className="text-caption"
              >
                <span className="text-body-strong text-danger">
                  {names.get(item.checkpointId) ?? 'Checkpoint'}
                </span>{' '}
                · {item.scheduleName} round from{' '}
                {formatPatrolTime(item.windowStart, timeZone)}, due by{' '}
                {formatPatrolClock(item.deadline, timeZone)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {current.length > 0 ? (
        <Card title="Rounds in progress">
          <ul className="grid gap-space-3">
            {current.map((round) => (
              <PatrolRoundItem
                key={`${round.scheduleId}-${round.start.toISOString()}`}
                round={round}
                checkpointNames={names}
                timeZone={timeZone}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card
        title="Incidents"
        description={`${openIncidents.length} open. Guards report incidents from the patrol screen.`}
      >
        {workspace.incidents.length === 0 ? (
          <p className="text-body text-ink-muted">No incidents reported.</p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.incidents.map((incident) => (
              <PatrolIncidentItem
                key={incident.id}
                incident={incident}
                timeZone={timeZone}
                request={fileRequest}
              >
                {manage && incident.status === 'open' ? (
                  <div className="grid gap-space-3">
                    <details className="grid gap-space-2">
                      <summary className={summaryClass}>
                        Add a follow-up note
                      </summary>
                      <ModuleActionForm
                        action={actions.addIncidentNote}
                        submitLabel="Add note"
                        input={(form) =>
                          patrolIncidentNoteInputSchema.parse({
                            incidentId: incident.id,
                            body: String(form.get('body') ?? ''),
                          })
                        }
                      >
                        <TextAreaInput
                          id={`${id}-note-${incident.id}`}
                          name="body"
                          label="Follow-up note"
                          required
                          maxLength={1000}
                        />
                      </ModuleActionForm>
                    </details>
                    <details className="grid gap-space-2">
                      <summary className={summaryClass}>
                        Close{' '}
                        {PATROL_CATEGORY_LABELS[
                          incident.category
                        ].toLowerCase()}{' '}
                        incident
                      </summary>
                      <ModuleActionForm
                        action={actions.closeIncident}
                        submitLabel="Close incident"
                        input={(form) =>
                          patrolIncidentCloseInputSchema.parse({
                            incidentId: incident.id,
                            resolution: String(form.get('resolution') ?? ''),
                          })
                        }
                      >
                        <TextAreaInput
                          id={`${id}-resolution-${incident.id}`}
                          name="resolution"
                          label="Resolution"
                          helpText="What was done. The reporting guard is told."
                          required
                          maxLength={1000}
                        />
                      </ModuleActionForm>
                    </details>
                  </div>
                ) : null}
              </PatrolIncidentItem>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Checkpoints"
        description={`${active.length} active. Each has a QR sticker and a typed code for phones that cannot scan.`}
      >
        <div className="grid gap-space-4">
          {manage && active.length > 0 ? (
            <a
              href="/admin/patrol/print"
              className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              Print the QR sheet (A4)
            </a>
          ) : null}
          {workspace.checkpoints.length === 0 ? (
            <p className="text-body text-ink-muted">No checkpoints yet.</p>
          ) : (
            <ul className="grid gap-space-3">
              {[...active, ...inactive].map((checkpoint) => (
                <li
                  key={checkpoint.id}
                  className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-4"
                >
                  <div className="grid gap-space-1">
                    <p className="text-body-strong break-words">
                      {checkpoint.name}
                      {checkpoint.active ? '' : ' (turned off)'}
                    </p>
                    <p className="text-caption text-ink-muted">
                      Code{' '}
                      <span className="font-mono text-ink">
                        {formatPatrolCode(checkpoint.code)}
                      </span>
                      {checkpoint.location_note
                        ? ` · ${checkpoint.location_note}`
                        : ''}
                    </p>
                  </div>
                  {manage ? (
                    <div className="grid gap-space-3">
                      <details className="grid gap-space-2">
                        <summary className={summaryClass}>
                          Edit {checkpoint.name}
                        </summary>
                        <CheckpointForm
                          checkpoint={checkpoint}
                          actions={actions}
                        />
                      </details>
                      <PatrolQuickAction
                        action={actions.setCheckpointActive}
                        input={{
                          checkpointId: checkpoint.id,
                          active: !checkpoint.active,
                          expectedVersion: checkpoint.version,
                        }}
                        label={
                          checkpoint.active
                            ? `Turn off ${checkpoint.name}`
                            : `Turn on ${checkpoint.name}`
                        }
                        confirmMessage={
                          checkpoint.active
                            ? 'Turn off this checkpoint? Guards can no longer scan it and rounds skip it until you turn it back on.'
                            : undefined
                        }
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {manage ? (
            <details className="grid gap-space-2">
              <summary className={summaryClass}>Add a checkpoint</summary>
              <CheckpointForm checkpoint={null} actions={actions} />
            </details>
          ) : null}
        </div>
      </Card>

      <Card
        title="Schedules"
        description="Each round needs every included checkpoint scanned once."
      >
        <div className="grid gap-space-4">
          {workspace.schedules.length === 0 ? (
            <p className="text-body text-ink-muted">No schedules yet.</p>
          ) : (
            <ul className="grid gap-space-3">
              {workspace.schedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-4"
                >
                  <div className="grid gap-space-1">
                    <p className="text-body-strong break-words">
                      {schedule.name}
                      {schedule.active ? '' : ' (turned off)'}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {formatClockTime(schedule.shift_start)} to{' '}
                      {formatClockTime(schedule.shift_end)}, a round{' '}
                      {formatInterval(schedule.interval_minutes)}, grace{' '}
                      {schedule.grace_minutes} minutes
                    </p>
                    <p className="text-caption">
                      {schedule.checkpoints
                        .map((link) => names.get(link.checkpoint_id))
                        .filter(Boolean)
                        .join(', ') || 'No checkpoints'}
                    </p>
                  </div>
                  {manage ? (
                    <div className="grid gap-space-3">
                      <details className="grid gap-space-2">
                        <summary className={summaryClass}>
                          Edit {schedule.name}
                        </summary>
                        <ScheduleForm
                          schedule={schedule}
                          checkpoints={active}
                          actions={actions}
                        />
                      </details>
                      <PatrolQuickAction
                        action={actions.setScheduleActive}
                        input={{
                          scheduleId: schedule.id,
                          active: !schedule.active,
                          expectedVersion: schedule.version,
                        }}
                        label={
                          schedule.active
                            ? `Turn off ${schedule.name}`
                            : `Turn on ${schedule.name}`
                        }
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {manage ? (
            <details className="grid gap-space-2">
              <summary className={summaryClass}>Add a schedule</summary>
              <ScheduleForm
                schedule={null}
                checkpoints={active}
                actions={actions}
              />
            </details>
          ) : null}
        </div>
      </Card>

      <Card
        title="Recent scans"
        description={`Who scanned what in the last ${MISSED_HOURS} hours.`}
      >
        {workspace.scans.length === 0 ? (
          <p className="text-body text-ink-muted">No scans.</p>
        ) : (
          <ul className="grid gap-space-2">
            {workspace.scans.slice(0, 50).map((scan) => (
              <li key={scan.id} className="text-caption">
                <span className="text-body-strong">
                  {names.get(scan.checkpoint_id) ?? 'Checkpoint'}
                </span>{' '}
                · {formatPatrolTime(scan.scanned_at, timeZone)} ·{' '}
                {scan.scanned_by_name}
                {scan.method === 'typed' ? ' · typed code' : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Shift handover notes" description="Last 7 days.">
        {workspace.handover_notes.length === 0 ? (
          <p className="text-body text-ink-muted">No recent notes.</p>
        ) : (
          <ul className="grid gap-space-3">
            {workspace.handover_notes.map((note) => (
              <PatrolHandoverItem
                key={note.id}
                note={{ ...note, is_mine: false }}
                timeZone={timeZone}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Photo retention"
        description="Incident photos are deleted automatically after this many days."
      >
        {manage ? (
          <ModuleActionForm
            action={actions.saveSettings}
            submitLabel="Save retention"
            input={(form) =>
              patrolSettingsInputSchema.parse({
                photoRetentionDays: Number(form.get('photoRetentionDays')),
              })
            }
          >
            <TextInput
              id={`${id}-retention`}
              name="photoRetentionDays"
              type="number"
              inputMode="numeric"
              label="Keep photos for (days)"
              helpText={`${PATROL_PHOTO_RETENTION_MIN_DAYS} to ${PATROL_PHOTO_RETENTION_MAX_DAYS} days.`}
              min={PATROL_PHOTO_RETENTION_MIN_DAYS}
              max={PATROL_PHOTO_RETENTION_MAX_DAYS}
              required
              defaultValue={workspace.settings.photo_retention_days}
            />
          </ModuleActionForm>
        ) : (
          <p className="text-body">
            Photos are kept for {workspace.settings.photo_retention_days} days.
          </p>
        )}
      </Card>
    </section>
  );
}
