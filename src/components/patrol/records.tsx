// Render patrol incidents, handover notes and round progress for guard and administrator screens.
'use client';
import type { ReactNode } from 'react';
import {
  PATROL_CATEGORY_LABELS,
  formatPatrolClock,
  formatPatrolTime,
} from '@/core/patrol/presentation';
import type { PatrolRound } from '@/core/patrol/rounds';
import type { PatrolHandover, PatrolIncident } from '@/core/patrol/validation';
import { PatrolPhotoLink, PatrolSeverityChip } from './shared';

export function PatrolIncidentItem({
  incident,
  timeZone,
  request,
  children,
}: {
  incident: PatrolIncident;
  timeZone: string;
  request?: typeof fetch;
  children?: ReactNode;
}) {
  return (
    <li className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <div className="flex flex-wrap items-center gap-space-2">
          <p className="text-body-strong">
            {PATROL_CATEGORY_LABELS[incident.category]}
          </p>
          <PatrolSeverityChip severity={incident.severity} />
          <span className="text-micro text-ink-muted">
            {incident.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        <p className="text-caption text-ink-muted">
          Reported by {incident.reported_by_name} on{' '}
          {formatPatrolTime(incident.created_at, timeZone)}
          {incident.location ? ` · ${incident.location}` : ''}
        </p>
        <p className="text-body break-words whitespace-pre-line">
          {incident.description}
        </p>
      </div>
      {incident.photo_paths.length > 0 ? (
        <div className="grid gap-space-2 medium:grid-cols-3">
          {incident.photo_paths.map((path, index) => (
            <PatrolPhotoLink
              key={path}
              path={path}
              index={index + 1}
              request={request}
            />
          ))}
        </div>
      ) : null}
      {incident.notes.length > 0 ? (
        <div className="grid gap-space-2">
          <h3 className="text-body-strong">Follow-up</h3>
          <ol className="grid gap-space-2">
            {incident.notes.map((note) => (
              <li key={note.id} className="text-caption">
                <span className="text-body-strong">{note.author_name}</span>,{' '}
                {formatPatrolTime(note.created_at, timeZone)}:{' '}
                <span className="break-words whitespace-pre-line">
                  {note.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {incident.status === 'closed' ? (
        <p className="text-caption">
          Closed
          {incident.closed_by_name ? ` by ${incident.closed_by_name}` : ''}
          {incident.closed_at
            ? ` on ${formatPatrolTime(incident.closed_at, timeZone)}`
            : ''}
          : <span className="break-words">{incident.resolution}</span>
        </p>
      ) : null}
      {children}
    </li>
  );
}

export function PatrolHandoverItem({
  note,
  timeZone,
  children,
}: {
  note: PatrolHandover;
  timeZone: string;
  children?: ReactNode;
}) {
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <p className="text-caption text-ink-muted">
        {note.is_mine ? 'You' : note.author_name} wrote on{' '}
        {formatPatrolTime(note.created_at, timeZone)}
      </p>
      <p className="text-body break-words whitespace-pre-line">{note.body}</p>
      <p className="text-caption">
        {note.acknowledged_at
          ? `Acknowledged by ${note.acknowledged_by_name ?? 'a guard'} on ${formatPatrolTime(note.acknowledged_at, timeZone)}`
          : 'Not acknowledged yet'}
      </p>
      {children}
    </li>
  );
}

const ROUND_STATUS_TEXT = {
  done: 'Scanned',
  missed: 'Missed',
  open: 'To scan',
  upcoming: 'Later',
} as const;

const ROUND_STATUS_CLASSES = {
  done: 'text-success',
  missed: 'text-danger',
  open: 'text-ink',
  upcoming: 'text-ink-muted',
} as const;

export function PatrolRoundItem({
  round,
  checkpointNames,
  timeZone,
}: {
  round: PatrolRound;
  checkpointNames: ReadonlyMap<string, string>;
  timeZone: string;
}) {
  const done = round.checkpoints.filter(
    (checkpoint) => checkpoint.status === 'done',
  ).length;
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <p className="text-body-strong">
        {round.scheduleName}: {formatPatrolClock(round.start, timeZone)} to{' '}
        {formatPatrolClock(round.end, timeZone)}
      </p>
      <p className="text-caption text-ink-muted">
        {done} of {round.checkpoints.length} scanned · finish by{' '}
        {formatPatrolClock(round.deadline, timeZone)}
      </p>
      <ul className="grid gap-space-1">
        {round.checkpoints.map((checkpoint) => (
          <li
            key={checkpoint.checkpointId}
            className="flex flex-wrap justify-between gap-space-2 text-body"
          >
            <span className="min-w-0 break-words">
              {checkpointNames.get(checkpoint.checkpointId) ?? 'Checkpoint'}
            </span>
            <span className={ROUND_STATUS_CLASSES[checkpoint.status]}>
              {ROUND_STATUS_TEXT[checkpoint.status]}
              {checkpoint.scannedAt
                ? ` at ${formatPatrolClock(checkpoint.scannedAt, timeZone)}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
