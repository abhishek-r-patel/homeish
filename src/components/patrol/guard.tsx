// Let guards follow patrol rounds, scan checkpoints, report incidents and hand over shifts on a phone.
'use client';
import { useId, useMemo } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import {
  computePatrolRounds,
  currentPatrolRounds,
  nextPatrolRounds,
} from '@/core/patrol/rounds';
import {
  patrolHandoverInputSchema,
  type PatrolGuardWorkspace,
} from '@/core/patrol/validation';
import { Card } from '@/components/ui/data-display';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import {
  PatrolHandoverItem,
  PatrolIncidentItem,
  PatrolRoundItem,
} from './records';
import { PatrolScanPanel } from './scanner';
import {
  PATROL_ACTIONS,
  PatrolIncidentForm,
  PatrolQuickAction,
  formatPatrolClock,
  formatPatrolTime,
  type PatrolActions,
} from './shared';

const HOUR = 3_600_000;

export function PatrolGuardView({
  workspace,
  actions = PATROL_ACTIONS,
  fileRequest,
}: {
  workspace: PatrolGuardWorkspace;
  actions?: PatrolActions;
  fileRequest?: typeof fetch;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const timeZone = workspace.timezone;
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
  const rounds = useMemo(
    () =>
      computePatrolRounds({
        timeZone,
        schedules: workspace.schedules,
        scans: workspace.scans,
        activeCheckpointIds: new Set(names.keys()),
        now,
        from: new Date(now.getTime() - 12 * HOUR),
        until: new Date(now.getTime() + 12 * HOUR),
      }),
    [timeZone, workspace.schedules, workspace.scans, names, now],
  );
  const current = currentPatrolRounds(rounds, now);
  const next = nextPatrolRounds(rounds, now);
  const recentScans = workspace.scans.slice(0, 10);

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">{t('Patrol')}</h1>

      <Card
        title={t('Current round')}
        description={t('Scan every checkpoint listed before the finish time.')}
      >
        {workspace.schedules.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t(
              'No patrol rounds are scheduled. You can still scan checkpoints as you pass them.',
            )}
          </p>
        ) : current.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No round is due right now.')}
            {next[0]
              ? ` ${t('The next round starts at {time}.', { time: formatPatrolClock(next[0].start, timeZone, locale) })}`
              : ''}
          </p>
        ) : (
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
        )}
      </Card>

      <Card
        title={t('Scan a checkpoint')}
        description={t('The camera starts only when you tap Scan.')}
      >
        <PatrolScanPanel action={actions.scan} />
      </Card>

      <Card
        title={t('Recent scans')}
        description={t('All guards, last 24 hours.')}
      >
        {recentScans.length === 0 ? (
          <p className="text-body text-ink-muted">{t('No scans yet.')}</p>
        ) : (
          <ul className="grid gap-space-2">
            {recentScans.map((scan) => (
              <li key={scan.id} className="text-caption">
                <span className="text-body-strong">
                  {names.get(scan.checkpoint_id) ?? t('Checkpoint')}
                </span>{' '}
                · {formatPatrolTime(scan.scanned_at, timeZone, locale)} ·{' '}
                {scan.is_mine ? t('You') : scan.scanned_by_name}
                {scan.method === 'typed' ? ` · ${t('typed code')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('Report an incident')}
        description={t(
          'Administrators see every report. High and critical alert them straight away.',
        )}
      >
        <PatrolIncidentForm
          action={actions.createIncident}
          request={fileRequest}
        />
      </Card>

      {workspace.incidents.length > 0 ? (
        <Card title={t('Your recent incidents')}>
          <ul className="grid gap-space-3">
            {workspace.incidents.map((incident) => (
              <PatrolIncidentItem
                key={incident.id}
                incident={incident}
                timeZone={timeZone}
                request={fileRequest}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card
        title={t('Shift handover')}
        description={t(
          'Notes from the last 7 days. Acknowledge a note when you take over.',
        )}
      >
        <div className="grid gap-space-4">
          <ModuleActionForm
            action={actions.createHandover}
            idempotent
            submitLabel={t('Save handover note')}
            input={(form, clientRequestId) =>
              patrolHandoverInputSchema.parse({
                body: String(form.get('body') ?? ''),
                clientRequestId,
              })
            }
          >
            <TextAreaInput
              id={`${id}-handover`}
              name="body"
              label={t('Handover note')}
              helpText={t(
                'What the next guard should know, for example a broken light or an expected delivery.',
              )}
              required
              maxLength={1000}
            />
          </ModuleActionForm>
          {workspace.handover_notes.length === 0 ? (
            <p className="text-body text-ink-muted">{t('No recent notes.')}</p>
          ) : (
            <ul className="grid gap-space-3">
              {workspace.handover_notes.map((note) => (
                <PatrolHandoverItem
                  key={note.id}
                  note={note}
                  timeZone={timeZone}
                >
                  {!note.is_mine && !note.acknowledged_at ? (
                    <PatrolQuickAction
                      action={actions.acknowledgeHandover}
                      input={{ noteId: note.id }}
                      label={t('Acknowledge')}
                    />
                  ) : null}
                </PatrolHandoverItem>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
