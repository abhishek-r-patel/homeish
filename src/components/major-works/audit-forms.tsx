// Render P50.1b structural-audit create, edit and void controls.
'use client';
import { useId } from 'react';
import {
  saveMajorWorksAuditAction,
  voidMajorWorksAuditAction,
} from '@/app/(admin)/admin/major-works/actions';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import {
  MAJOR_WORKS_AUDIT_RATINGS,
  MAJOR_WORKS_AUDIT_REPAIR_STATUSES,
  type MajorWorksAudits,
} from '@/core/major-works/validation';
import { MajorWorksAuditFileUpload } from './audit-file-upload';

const RATING_LABELS = {
  fine: 'Fine',
  minor_repairs: 'Minor repairs',
  major_repairs: 'Major repairs',
  unsafe: 'Unsafe',
} as const;
const REPAIR_LABELS = {
  not_needed: 'Not needed',
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
} as const;

export type MajorWorksAudit = MajorWorksAudits['audits'][number];

export function MajorWorksAuditForm({
  action = saveMajorWorksAuditAction,
  audit,
  projects,
}: {
  action?: ModuleFormAction;
  audit?: MajorWorksAudit;
  projects: MajorWorksAudits['projects'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={
        audit ? t('Save structural audit') : t('Add structural audit')
      }
      input={(data) => ({
        auditId: audit?.id ?? null,
        auditOn: data.get('auditOn'),
        auditorName: data.get('auditorName'),
        findings: data.get('findings'),
        rating: data.get('rating'),
        reportPath: data.get('reportPath') || '',
        repairStatus: data.get('repairStatus'),
        nextDueOn: data.get('nextDueOn'),
        projectIds: data.getAll('projectIds'),
        expectedUpdatedAt: audit?.updated_at ?? null,
      })}
    >
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={audit?.audit_on ?? ''}
          id={`${id}-date`}
          label={t('Audit date')}
          name="auditOn"
          required
          type="date"
        />
        <TextInput
          defaultValue={audit?.auditor_name ?? ''}
          id={`${id}-auditor`}
          label={t('Auditor name')}
          maxLength={120}
          name="auditorName"
          required
        />
        <SelectInput
          defaultValue={audit?.rating ?? 'fine'}
          id={`${id}-rating`}
          label={t('Rating')}
          name="rating"
          options={MAJOR_WORKS_AUDIT_RATINGS.map((rating) => ({
            value: rating,
            label: t(RATING_LABELS[rating]),
          }))}
          required
        />
        <SelectInput
          defaultValue={audit?.repair_status ?? 'not_needed'}
          id={`${id}-repair`}
          label={t('Repair status')}
          name="repairStatus"
          options={MAJOR_WORKS_AUDIT_REPAIR_STATUSES.map((status) => ({
            value: status,
            label: t(REPAIR_LABELS[status]),
          }))}
          required
        />
        <TextInput
          defaultValue={audit?.next_due_on ?? ''}
          id={`${id}-next`}
          label={t('Next due date')}
          name="nextDueOn"
          required
          type="date"
        />
      </div>
      <TextAreaInput
        defaultValue={audit?.findings ?? ''}
        id={`${id}-findings`}
        label={t('Findings summary')}
        maxLength={2000}
        name="findings"
        required
        rows={5}
      />
      {projects.length ? (
        <fieldset className="grid gap-space-2">
          <legend className="text-body-strong">
            {t('Linked repair projects')}
          </legend>
          {projects.map((project) => (
            <CheckboxInput
              defaultChecked={audit?.projects.some(
                (linked) => linked.id === project.id,
              )}
              id={`${id}-project-${project.id}`}
              key={project.id}
              label={project.title}
              name="projectIds"
              value={project.id}
            />
          ))}
        </fieldset>
      ) : null}
      <MajorWorksAuditFileUpload initialPath={audit?.report_path ?? null} />
    </ModuleActionForm>
  );
}

export function MajorWorksAuditVoidForm({
  action = voidMajorWorksAuditAction,
  audit,
}: {
  action?: ModuleFormAction;
  audit: MajorWorksAudit;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  if (audit.voided_at) return null;
  return (
    <ModuleActionForm
      action={action}
      confirmMessage="Void this structural audit? The report and history stay saved."
      idempotent
      submitLabel={t('Void structural audit')}
      input={(data) => ({
        auditId: audit.id,
        reason: data.get('reason'),
        expectedUpdatedAt: audit.updated_at,
      })}
    >
      <TextAreaInput
        id={`${id}-reason`}
        label={t('Void reason')}
        maxLength={500}
        minLength={5}
        name="reason"
        required
        rows={2}
      />
    </ModuleActionForm>
  );
}

export { RATING_LABELS, REPAIR_LABELS };
