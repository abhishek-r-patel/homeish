// Render patrol incidents, handover notes and round progress for guard and administrator screens.
'use client';
import type { ReactNode } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import { PATROL_CATEGORY_LABELS } from '@/core/patrol/presentation';
import type { PatrolRound } from '@/core/patrol/rounds';
import type { PatrolHandover, PatrolIncident } from '@/core/patrol/validation';
import {
  PatrolPhotoLink,
  PatrolSeverityChip,
  formatPatrolClock,
  formatPatrolTime,
} from './shared';

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
  const { locale, translate: t } = useUiTranslator();
  return (
    <li className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-4">
      <div className="grid gap-space-1">
        <div className="flex flex-wrap items-center gap-space-2">
          <p className="text-body-strong">
            {t(PATROL_CATEGORY_LABELS[incident.category])}
          </p>
          <PatrolSeverityChip severity={incident.severity} />
          <span className="text-micro text-ink-muted">
            {t(incident.status === 'open' ? 'Open' : 'Closed')}
          </span>
        </div>
        <p className="text-caption text-ink-muted">
          {t('Reported by {name} on {date}', {
            name: incident.reported_by_name,
            date: formatPatrolTime(incident.created_at, timeZone, locale),
          })}
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
          <h3 className="text-body-strong">{t('Follow-up')}</h3>
          <ol className="grid gap-space-2">
            {incident.notes.map((note) => (
              <li key={note.id} className="text-caption">
                <span className="text-body-strong">{note.author_name}</span>,{' '}
                {formatPatrolTime(note.created_at, timeZone, locale)}:{' '}
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
          {t(
            incident.closed_by_name && incident.closed_at
              ? 'Closed by {name} on {date}'
              : incident.closed_by_name
                ? 'Closed by {name}'
                : incident.closed_at
                  ? 'Closed on {date}'
                  : 'Closed',
            {
              name: incident.closed_by_name ?? '',
              date: incident.closed_at
                ? formatPatrolTime(incident.closed_at, timeZone, locale)
                : '',
            },
          )}
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
  const { locale, translate: t } = useUiTranslator();
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <p className="text-caption text-ink-muted">
        {t('{name} wrote on {date}', {
          name: note.is_mine ? t('You') : note.author_name,
          date: formatPatrolTime(note.created_at, timeZone, locale),
        })}
      </p>
      <p className="text-body break-words whitespace-pre-line">{note.body}</p>
      <p className="text-caption">
        {note.acknowledged_at
          ? t('Acknowledged by {name} on {date}', {
              name: note.acknowledged_by_name ?? t('a guard'),
              date: formatPatrolTime(note.acknowledged_at, timeZone, locale),
            })
          : t('Not acknowledged yet')}
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
  const { locale, translate: t } = useUiTranslator();
  const done = round.checkpoints.filter(
    (checkpoint) => checkpoint.status === 'done',
  ).length;
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <p className="text-body-strong">
        {t('{name}: {start} to {end}', {
          name: round.scheduleName,
          start: formatPatrolClock(round.start, timeZone, locale),
          end: formatPatrolClock(round.end, timeZone, locale),
        })}
      </p>
      <p className="text-caption text-ink-muted">
        {t('{count} of {total} scanned · finish by {time}', {
          count: formatLocalizedNumber(done, locale ?? 'en'),
          total: formatLocalizedNumber(
            round.checkpoints.length,
            locale ?? 'en',
          ),
          time: formatPatrolClock(round.deadline, timeZone, locale),
        })}
      </p>
      <ul className="grid gap-space-1">
        {round.checkpoints.map((checkpoint) => (
          <li
            key={checkpoint.checkpointId}
            className="flex flex-wrap justify-between gap-space-2 text-body"
          >
            <span className="min-w-0 break-words">
              {checkpointNames.get(checkpoint.checkpointId) ?? t('Checkpoint')}
            </span>
            <span className={ROUND_STATUS_CLASSES[checkpoint.status]}>
              {t(ROUND_STATUS_TEXT[checkpoint.status])}
              {checkpoint.scannedAt
                ? ` ${t('at {time}', { time: formatPatrolClock(checkpoint.scannedAt, timeZone, locale) })}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
