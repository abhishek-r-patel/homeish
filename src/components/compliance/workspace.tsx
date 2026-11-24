// Show factual compliance records with an accepted-risk acknowledgement gate.
'use client';

import { useId } from 'react';
import Link from 'next/link';
import {
  acknowledgeComplianceAction,
  saveComplianceEntryAction,
  saveComplianceRemindersAction,
} from '@/app/(admin)/admin/compliance/actions';
import type { ComplianceWorkspace } from '@/core/compliance/validation';
import { Card } from '@/components/ui/data-display';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { documentDownloadAction } from '@/app/(resident)/documents/actions';
import { DocumentDownloadButton } from '@/components/document/files';

const control =
  'min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3';
const recurrenceLabels = {
  none: 'No repeat',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
} as const;

export function ComplianceWorkspaceView({
  workspace,
}: {
  workspace: ComplianceWorkspace;
}) {
  const { translate: t } = useUiTranslator();
  if (workspace.acknowledged_at === null && !workspace.can_manage) {
    return (
      <section className="grid gap-space-4">
        <h1 className="text-title font-semibold">{t('Compliance register')}</h1>
        <Card title={t('Register not acknowledged yet')}>
          <p>{t(workspace.warning)}</p>
          <p className="text-caption text-ink-muted">
            {t(
              'An administrator must record the accepted-risk acknowledgement before the register is available.',
            )}
          </p>
        </Card>
      </section>
    );
  }
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Compliance register')}</h1>
        <p>{t(workspace.warning)}</p>
        <p className="text-caption text-ink-muted">
          {t(
            'Homeish supplies no obligations or deadlines. Enter only facts verified by your society and keep the original authority.',
          )}
        </p>
      </header>
      {workspace.acknowledged_at === null ? (
        <Card title={t('Acknowledgement required')}>
          <ModuleActionForm
            action={acknowledgeComplianceAction}
            input={() => ({})}
            submitLabel={t('Acknowledge and continue')}
          >
            <label className="flex items-start gap-space-3">
              <input
                className="mt-space-1 size-5"
                name="accepted"
                required
                type="checkbox"
                value="true"
              />
              <span>{t(workspace.warning)}</span>
            </label>
          </ModuleActionForm>
        </Card>
      ) : (
        <>
          {workspace.can_manage ? (
            <Card title={t('Add compliance obligation')}>
              <ComplianceEntryForm workspace={workspace} />
            </Card>
          ) : null}
          <Card title={t('Reminder settings')}>
            {workspace.can_manage ? (
              <ModuleActionForm
                action={saveComplianceRemindersAction}
                input={(form) => ({
                  enabled: form.get('enabled') === 'on',
                })}
                submitLabel={t('Save compliance reminders')}
              >
                <label className="flex items-start gap-space-3">
                  <input
                    defaultChecked={workspace.reminders_enabled}
                    name="enabled"
                    type="checkbox"
                  />
                  <span>
                    {t(
                      'Send in-app reminders to administrators 30 and 7 days before a verified due date.',
                    )}
                  </span>
                </label>
                <p className="text-caption text-ink-muted">
                  {t('Off by default. No email, SMS or WhatsApp is sent.')}
                </p>
              </ModuleActionForm>
            ) : (
              <p>
                {workspace.reminders_enabled
                  ? t('30-day and 7-day reminders are on.')
                  : t('Reminders are off.')}
              </p>
            )}
          </Card>
          <Card title={t('Obligations and evidence')}>
            {workspace.entries.length === 0 ? (
              <p>{t('No compliance obligations have been entered yet.')}</p>
            ) : (
              <ul className="grid gap-space-3">
                {workspace.entries.map((entry) => (
                  <li
                    className="grid gap-space-3 rounded-md border border-rule p-space-3"
                    key={entry.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-space-3">
                      <div className="grid gap-space-1">
                        <h2 className="text-body-strong">{entry.title}</h2>
                        <p className="text-caption text-ink-muted">
                          {entry.authority} ·{' '}
                          {t(recurrenceLabels[entry.recurrence])}
                        </p>
                      </div>
                      <span
                        className={`rounded-pill px-space-3 py-space-1 text-caption font-semibold ${
                          entry.status === 'done'
                            ? 'bg-success-tint text-success'
                            : entry.due_state === 'overdue'
                              ? 'bg-danger-tint text-danger'
                              : entry.due_state === 'due_today'
                                ? 'bg-warning-tint text-warning'
                                : 'bg-neutral-tint text-neutral'
                        }`}
                      >
                        {t(dueStateLabel(entry.due_state))}
                      </span>
                    </div>
                    <dl className="grid gap-space-2 text-body">
                      <div>
                        <dt className="inline font-semibold">
                          {t('Due date')}:{' '}
                        </dt>
                        <dd className="inline">{entry.due_date}</dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold">
                          {t('Responsible member')}:{' '}
                        </dt>
                        <dd className="inline">{entry.responsible_name}</dd>
                      </div>
                      {entry.completed_on ? (
                        <div>
                          <dt className="inline font-semibold">
                            {t('Completion date')}:{' '}
                          </dt>
                          <dd className="inline">{entry.completed_on}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {entry.note ? (
                      <p className="whitespace-pre-wrap break-words">
                        {entry.note}
                      </p>
                    ) : null}
                    {entry.evidence_name ? (
                      <div className="grid gap-space-2">
                        <p>
                          {t('Evidence')}: {entry.evidence_name}
                        </p>
                        {entry.evidence_version_id ? (
                          <DocumentDownloadButton
                            download={documentDownloadAction}
                            label={entry.evidence_name}
                            versionId={entry.evidence_version_id}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-caption text-ink-muted">
                        {t('No evidence file linked.')}
                      </p>
                    )}
                    {workspace.can_manage ? (
                      <details>
                        <summary>{t('Edit factual record')}</summary>
                        <ComplianceEntryForm
                          entry={entry}
                          workspace={workspace}
                        />
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <Link
        className="text-brand underline"
        href="/admin/settings#data-cleanup"
      >
        {t('Open data cleanup settings')}
      </Link>
    </section>
  );
}

function dueStateLabel(value: string) {
  return (
    {
      upcoming: 'Upcoming',
      due_today: 'Due today',
      overdue: 'Overdue',
      done: 'Done',
      not_applicable: 'Not applicable',
    }[value] ?? value
  );
}

function ComplianceEntryForm({
  entry,
  workspace,
}: {
  entry?: ComplianceWorkspace['entries'][number];
  workspace: ComplianceWorkspace;
}) {
  const id = useId();
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={saveComplianceEntryAction}
      idempotent
      input={(form) => ({
        id: entry?.id ?? null,
        title: form.get('title'),
        authority: form.get('authority'),
        recurrence: form.get('recurrence'),
        dueDate: form.get('dueDate'),
        responsibleMembershipId: form.get('responsibleMembershipId'),
        status: form.get('status'),
        completedOn: String(form.get('completedOn') ?? '') || null,
        evidenceVersionId: String(form.get('evidenceVersionId') ?? '') || null,
        note: String(form.get('note') ?? ''),
        expectedVersion: entry?.version ?? null,
        reason: entry ? form.get('reason') : null,
      })}
      submitLabel={t(entry ? 'Save factual record' : 'Add factual record')}
    >
      <TextInput
        defaultValue={entry?.title ?? ''}
        id={`${id}-title`}
        label={t('Obligation title')}
        maxLength={120}
        name="title"
        required
      />
      <TextInput
        defaultValue={entry?.authority ?? ''}
        id={`${id}-authority`}
        label={t('Verified authority or source')}
        maxLength={120}
        name="authority"
        required
      />
      <label className="grid gap-space-1">
        {t('Repeat')}
        <select
          className={control}
          defaultValue={entry?.recurrence ?? 'none'}
          name="recurrence"
        >
          {Object.entries(recurrenceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        defaultValue={entry?.due_date ?? ''}
        id={`${id}-due`}
        label={t('Verified due date')}
        name="dueDate"
        required
        type="date"
      />
      <label className="grid gap-space-1">
        {t('Responsible member')}
        <select
          className={control}
          defaultValue={entry?.responsible_membership_id ?? ''}
          name="responsibleMembershipId"
          required
        >
          <option value="">{t('Choose a member')}</option>
          {workspace.responsible_choices.map((member) => (
            <option key={member.membership_id} value={member.membership_id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-space-1">
        {t('Recorded status')}
        <select
          className={control}
          defaultValue={entry?.status ?? 'pending'}
          name="status"
        >
          <option value="pending">{t('Pending')}</option>
          <option value="done">{t('Done')}</option>
          <option value="not_applicable">{t('Not applicable')}</option>
        </select>
      </label>
      <TextInput
        defaultValue={entry?.completed_on ?? ''}
        id={`${id}-completed`}
        label={t('Verified completion date (for Done)')}
        name="completedOn"
        type="date"
      />
      <label className="grid gap-space-1">
        {t('Evidence file (optional)')}
        <select
          className={control}
          defaultValue={entry?.evidence_version_id ?? ''}
          name="evidenceVersionId"
        >
          <option value="">{t('No file linked')}</option>
          {workspace.evidence_choices.map((choice) => (
            <option key={choice.version_id} value={choice.version_id}>
              {choice.document_title} · {choice.file_name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-space-1">
        {t('Factual note')}
        <textarea
          className={`${control} min-h-24`}
          defaultValue={entry?.note ?? ''}
          maxLength={2000}
          name="note"
        />
      </label>
      {entry ? (
        <TextInput
          id={`${id}-reason`}
          label={t('Reason for this revision')}
          maxLength={500}
          name="reason"
          required
        />
      ) : null}
      <p className="text-caption text-ink-muted">
        {t(
          'Do not treat an evidence file, completion date or this register as legal certification.',
        )}
      </p>
    </ModuleActionForm>
  );
}
