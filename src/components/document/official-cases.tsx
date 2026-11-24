// Manage factual official correspondence and its private-from-creation evidence.
'use client';

import { useId } from 'react';
import {
  linkOfficialCaseEvidenceAction,
  saveOfficialCaseAction,
  saveOfficialCaseRemindersAction,
} from '@/app/(admin)/admin/documents/case-actions';
import type { OfficialCaseWorkspace } from '@/core/document/official-cases-validation';
import { Card } from '@/components/ui/data-display';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { documentDownloadAction } from '@/app/(resident)/documents/actions';
import { DocumentDownloadButton } from './files';

const control =
  'min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3';

export function OfficialCasesWorkspace({
  workspace,
}: {
  workspace: OfficialCaseWorkspace;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <Card title={t('Official correspondence and cases')}>
      <div className="grid gap-space-5">
        <p>{t(workspace.warning)}</p>
        {!workspace.acknowledged ? (
          <p className="text-caption text-ink-muted">
            {t(
              'An administrator must first acknowledge the warning in the Compliance register.',
            )}
          </p>
        ) : (
          <>
            <ModuleActionForm
              action={saveOfficialCaseRemindersAction}
              input={(form) => ({ enabled: form.get('enabled') === 'on' })}
              submitLabel={t('Save official case reminders')}
            >
              <label className="flex items-start gap-space-3">
                <input
                  defaultChecked={workspace.reminders_enabled}
                  name="enabled"
                  type="checkbox"
                />
                <span>
                  {t(
                    'Send admin-only in-app reminders 30 and 7 days before a recorded reply or hearing date.',
                  )}
                </span>
              </label>
              <p className="text-caption text-ink-muted">
                {t('Off by default. No email, SMS or WhatsApp is sent.')}
              </p>
            </ModuleActionForm>
            <OfficialCaseForm workspace={workspace} />
            {workspace.cases.length === 0 ? (
              <p>{t('No official cases have been entered.')}</p>
            ) : (
              <ul className="grid gap-space-3">
                {workspace.cases.map((item) => (
                  <li
                    className="grid gap-space-3 rounded-md border border-rule p-space-3"
                    key={item.id}
                  >
                    <div className="grid gap-space-1">
                      <h3 className="text-body-strong">{item.subject}</h3>
                      <p className="text-caption text-ink-muted">
                        {item.authority} · {item.reference} ·{' '}
                        {t(item.status === 'closed' ? 'Closed' : 'Open')}
                      </p>
                    </div>
                    {item.next_date ? (
                      <p>
                        {t('Next recorded date')}: {item.next_date}
                      </p>
                    ) : null}
                    {item.reviewer_name ? (
                      <p>
                        {t('Reviewer')}: {item.reviewer_name}
                      </p>
                    ) : null}
                    {item.compliance_title ? (
                      <p>
                        {t('Compliance link')}: {item.compliance_title}
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="whitespace-pre-wrap break-words">
                        {item.note}
                      </p>
                    ) : null}
                    {item.evidence.length ? (
                      <ul className="grid gap-space-1 text-caption">
                        {item.evidence.map((evidence) => (
                          <li
                            className="grid gap-space-2"
                            key={evidence.version_id}
                          >
                            <span>
                              {evidence.document_title} · {evidence.file_name}
                            </span>
                            <DocumentDownloadButton
                              download={documentDownloadAction}
                              label={evidence.file_name}
                              versionId={evidence.version_id}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-caption text-ink-muted">
                        {t('No private evidence linked.')}
                      </p>
                    )}
                    <ModuleActionForm
                      action={linkOfficialCaseEvidenceAction}
                      input={(form) => ({
                        caseId: item.id,
                        versionId: form.get('versionId'),
                      })}
                      submitLabel={t('Link private case evidence')}
                    >
                      <label className="grid gap-space-1">
                        {t('Admin-only evidence file')}
                        <select className={control} name="versionId" required>
                          <option value="">{t('Choose a private file')}</option>
                          {workspace.evidence_choices.map((choice) => (
                            <option
                              key={choice.version_id}
                              value={choice.version_id}
                            >
                              {choice.document_title} · {choice.file_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </ModuleActionForm>
                    <details>
                      <summary>{t('Edit official case')}</summary>
                      <OfficialCaseForm item={item} workspace={workspace} />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function OfficialCaseForm({
  item,
  workspace,
}: {
  item?: OfficialCaseWorkspace['cases'][number];
  workspace: OfficialCaseWorkspace;
}) {
  const id = useId();
  const { translate: t } = useUiTranslator();
  const blank = (value: string | null | undefined) => value ?? '';
  return (
    <ModuleActionForm
      action={saveOfficialCaseAction}
      idempotent
      input={(form) => ({
        id: item?.id ?? null,
        authority: form.get('authority'),
        reference: form.get('reference'),
        subject: form.get('subject'),
        relevantPeriod: String(form.get('relevantPeriod') ?? ''),
        receivedOn: String(form.get('receivedOn') ?? '') || null,
        filedOn: String(form.get('filedOn') ?? '') || null,
        filingMode: String(form.get('filingMode') ?? '').trim() || null,
        filingAcknowledgement:
          String(form.get('filingAcknowledgement') ?? '').trim() || null,
        replyDueOn: String(form.get('replyDueOn') ?? '') || null,
        hearingOn: String(form.get('hearingOn') ?? '') || null,
        responseOn: String(form.get('responseOn') ?? '') || null,
        status: form.get('status'),
        reviewerMembershipId:
          String(form.get('reviewerMembershipId') ?? '') || null,
        complianceEntryId: String(form.get('complianceEntryId') ?? '') || null,
        closedOn: String(form.get('closedOn') ?? '') || null,
        note: String(form.get('note') ?? ''),
        expectedVersion: item?.version ?? null,
        reason: item ? form.get('reason') : null,
      })}
      submitLabel={t(item ? 'Save official case' : 'Add official case')}
    >
      <TextInput
        defaultValue={item?.authority ?? ''}
        id={`${id}-authority`}
        label={t('Government or regulatory authority')}
        maxLength={120}
        name="authority"
        required
      />
      <TextInput
        defaultValue={item?.reference ?? ''}
        id={`${id}-reference`}
        label={t('Reference')}
        maxLength={120}
        name="reference"
        required
      />
      <TextInput
        defaultValue={item?.subject ?? ''}
        id={`${id}-subject`}
        label={t('Subject')}
        maxLength={200}
        name="subject"
        required
      />
      <TextInput
        defaultValue={item?.relevant_period ?? ''}
        id={`${id}-period`}
        label={t('Relevant period (optional)')}
        maxLength={120}
        name="relevantPeriod"
      />
      {[
        ['receivedOn', 'Received date', item?.received_on],
        ['filedOn', 'Filing date', item?.filed_on],
        ['replyDueOn', 'Reply due date', item?.reply_due_on],
        ['hearingOn', 'Hearing or deadline date', item?.hearing_on],
        ['responseOn', 'Response date', item?.response_on],
        ['closedOn', 'Closed date (for Closed)', item?.closed_on],
      ].map(([name, label, value]) => (
        <TextInput
          defaultValue={blank(String(value ?? ''))}
          id={`${id}-${name}`}
          key={name}
          label={t(String(label))}
          name={String(name)}
          type="date"
        />
      ))}
      <TextInput
        defaultValue={item?.filing_mode ?? ''}
        id={`${id}-mode`}
        label={t('Filing mode (optional)')}
        maxLength={120}
        name="filingMode"
      />
      <TextInput
        defaultValue={item?.filing_acknowledgement ?? ''}
        id={`${id}-ack`}
        label={t('Filing acknowledgement (optional)')}
        maxLength={200}
        name="filingAcknowledgement"
      />
      <label className="grid gap-space-1">
        {t('Status')}
        <select
          className={control}
          defaultValue={item?.status ?? 'open'}
          name="status"
        >
          <option value="open">{t('Open')}</option>
          <option value="closed">{t('Closed')}</option>
        </select>
      </label>
      <label className="grid gap-space-1">
        {t('Reviewer (optional)')}
        <select
          className={control}
          defaultValue={item?.reviewer_membership_id ?? ''}
          name="reviewerMembershipId"
        >
          <option value="">{t('No reviewer')}</option>
          {workspace.reviewer_choices.map((reviewer) => (
            <option key={reviewer.membership_id} value={reviewer.membership_id}>
              {reviewer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-space-1">
        {t('Compliance record (optional)')}
        <select
          className={control}
          defaultValue={item?.compliance_entry_id ?? ''}
          name="complianceEntryId"
        >
          <option value="">{t('No compliance link')}</option>
          {workspace.compliance_choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-space-1">
        {t('Factual case note')}
        <textarea
          className={`${control} min-h-24`}
          defaultValue={item?.note ?? ''}
          maxLength={5000}
          name="note"
        />
      </label>
      {item ? (
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
          'This log does not send, submit or draft a legal response, calculate liability or grant access to evidence.',
        )}
      </p>
    </ModuleActionForm>
  );
}
