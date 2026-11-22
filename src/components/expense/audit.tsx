// Edit P41 audit tracker records with acknowledgement, versions and history.
'use client';
import { useId } from 'react';
import {
  acknowledgeExpenseAuditWarningAction,
  saveExpenseAuditObjectionAction,
  saveExpenseAuditQueryAction,
  saveExpenseAuditYearAction,
} from '@/app/(admin)/admin/expenses/actions';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { useUiTranslator } from '@/components/ui/language';
import {
  EXPENSE_AGM_WARNING,
  type ExpenseAudit,
} from '@/core/expense/validation';

const optional = (value: FormDataEntryValue | null) =>
  typeof value === 'string' && value.trim() ? value : null;

export function ExpenseAuditWarningForm({
  action = acknowledgeExpenseAuditWarningAction,
}: {
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Acknowledge and continue')}
      input={(data) => ({ acknowledged: data.get('acknowledged') === 'on' })}
    >
      <p>{t(EXPENSE_AGM_WARNING)}</p>
      <CheckboxInput
        id={`${id}-ack`}
        name="acknowledged"
        label={t(
          'I understand the warning and will use this only as a tracker and draft.',
        )}
        required
      />
    </ModuleActionForm>
  );
}

export function ExpenseAuditYearForm({
  action = saveExpenseAuditYearAction,
  documents,
  financialYearStart,
  year,
}: {
  action?: ModuleFormAction;
  documents: ExpenseAudit['documents'];
  financialYearStart: string;
  year: ExpenseAudit['year'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t(year ? 'Save audit year' : 'Start audit year')}
      input={(data) => ({
        yearId: year?.id ?? null,
        financialYearStart,
        auditorName: data.get('auditorName'),
        auditorFirm: data.get('auditorFirm'),
        appointedOn: data.get('appointedOn'),
        appointmentReference: optional(data.get('appointmentReference')),
        appointmentDocumentId: optional(data.get('appointmentDocumentId')),
        reportReceivedOn: optional(data.get('reportReceivedOn')),
        placedBeforeAgmOn: optional(data.get('placedBeforeAgmOn')),
        filedOn: optional(data.get('filedOn')),
        opinion: optional(data.get('opinion')),
        opinionText: optional(data.get('opinionText')),
        expectedVersion: year?.version ?? null,
      })}
    >
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
        <TextInput
          id={`${id}-auditor`}
          label={t('Auditor name')}
          name="auditorName"
          required
          maxLength={120}
          defaultValue={year?.auditor_name}
        />
        <TextInput
          id={`${id}-firm`}
          label={t('Firm')}
          name="auditorFirm"
          required
          maxLength={160}
          defaultValue={year?.auditor_firm}
        />
        <TextInput
          id={`${id}-appointed`}
          label={t('Appointment date')}
          name="appointedOn"
          type="date"
          required
          defaultValue={year?.appointed_on}
        />
        <TextInput
          id={`${id}-reference`}
          label={t('Appointment decision reference')}
          name="appointmentReference"
          maxLength={160}
          defaultValue={year?.appointment_reference ?? ''}
        />
        <SelectInput
          id={`${id}-document`}
          label={t('Appointment P19 document')}
          name="appointmentDocumentId"
          defaultValue={year?.appointment_document_id ?? ''}
          options={[
            { value: '', label: t('No linked document') },
            ...documents.map((document) => ({
              value: document.id,
              label: document.title,
            })),
          ]}
        />
        <TextInput
          id={`${id}-received`}
          label={t('Report received on')}
          name="reportReceivedOn"
          type="date"
          defaultValue={year?.report_received_on ?? ''}
        />
        <TextInput
          id={`${id}-agm`}
          label={t('Placed before AGM on')}
          name="placedBeforeAgmOn"
          type="date"
          defaultValue={year?.placed_before_agm_on ?? ''}
        />
        <TextInput
          id={`${id}-filed`}
          label={t('Filed on')}
          name="filedOn"
          type="date"
          defaultValue={year?.filed_on ?? ''}
        />
        <SelectInput
          id={`${id}-opinion`}
          label={t('Opinion copied from the report')}
          name="opinion"
          defaultValue={year?.opinion ?? ''}
          options={[
            { value: '', label: t('Not recorded') },
            { value: 'unmodified', label: t('Unmodified') },
            { value: 'qualified', label: t('Qualified') },
            { value: 'adverse', label: t('Adverse') },
            { value: 'disclaimer', label: t('Disclaimer') },
            { value: 'other', label: t('Other') },
          ]}
        />
      </div>
      <TextAreaInput
        id={`${id}-opinion-text`}
        label={t('Opinion text from the source report')}
        name="opinionText"
        maxLength={4000}
        defaultValue={year?.opinion_text ?? ''}
      />
    </ModuleActionForm>
  );
}

export function ExpenseAuditQueryForm({
  action = saveExpenseAuditQueryAction,
  auditYearId,
  staff,
  query,
  today,
}: {
  action?: ModuleFormAction;
  auditYearId: string;
  staff: ExpenseAudit['staff'];
  query: ExpenseAudit['queries'][number] | null;
  today: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t(query ? 'Save query' : 'Add query')}
      input={(data) => ({
        queryId: query?.id ?? null,
        auditYearId,
        queryNumber: Number(data.get('queryNumber')),
        queryDate: data.get('queryDate'),
        area: data.get('area'),
        question: data.get('question'),
        assigneeUserId: data.get('assigneeUserId'),
        dueDate: data.get('dueDate'),
        response: optional(data.get('response')),
        responseDate: optional(data.get('responseDate')),
        expectedVersion: query?.version ?? null,
      })}
    >
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
        <TextInput
          id={`${id}-number`}
          label={t('Query number')}
          name="queryNumber"
          type="number"
          required
          min={1}
          defaultValue={query?.query_number}
        />
        <TextInput
          id={`${id}-date`}
          label={t('Query date')}
          name="queryDate"
          type="date"
          required
          max={today}
          defaultValue={query?.query_date ?? today}
        />
        <TextInput
          id={`${id}-area`}
          label={t('Area')}
          name="area"
          required
          maxLength={120}
          defaultValue={query?.area}
        />
        <SelectInput
          id={`${id}-assignee`}
          label={t('Assignee')}
          name="assigneeUserId"
          required
          defaultValue={query?.assignee_user_id ?? ''}
          placeholder={t('Choose an admin or committee member')}
          options={staff.map((member) => ({
            value: member.user_id,
            label: member.full_name,
          }))}
        />
        <TextInput
          id={`${id}-due`}
          label={t('Due date')}
          name="dueDate"
          type="date"
          required
          defaultValue={query?.due_date ?? today}
        />
        <TextInput
          id={`${id}-response-date`}
          label={t('Response date')}
          name="responseDate"
          type="date"
          defaultValue={query?.response_date ?? ''}
        />
      </div>
      <TextAreaInput
        id={`${id}-question`}
        label={t('Question')}
        name="question"
        maxLength={4000}
        required
        defaultValue={query?.question}
      />
      <TextAreaInput
        id={`${id}-response`}
        label={t('Response')}
        name="response"
        maxLength={4000}
        defaultValue={query?.response ?? ''}
      />
    </ModuleActionForm>
  );
}

export function ExpenseAuditObjectionForm({
  action = saveExpenseAuditObjectionAction,
  documents,
  auditYearId,
  objection,
  staff,
  today,
}: {
  action?: ModuleFormAction;
  documents: ExpenseAudit['documents'];
  auditYearId: string;
  objection: ExpenseAudit['objections'][number] | null;
  staff: ExpenseAudit['staff'];
  today: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t(objection ? 'Save objection' : 'Add objection')}
      input={(data) => ({
        objectionId: objection?.id ?? null,
        auditYearId,
        description: data.get('description'),
        ownerUserId: data.get('ownerUserId'),
        dueDate: data.get('dueDate'),
        correctionNote: optional(data.get('correctionNote')),
        correctedOn: optional(data.get('correctedOn')),
        evidenceDocumentId: optional(data.get('evidenceDocumentId')),
        expectedVersion: objection?.version ?? null,
      })}
    >
      <TextAreaInput
        id={`${id}-description`}
        label={t('Objection')}
        name="description"
        maxLength={4000}
        required
        defaultValue={objection?.description}
      />
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2">
        <SelectInput
          id={`${id}-owner`}
          label={t('Owner')}
          name="ownerUserId"
          required
          defaultValue={objection?.owner_user_id ?? ''}
          placeholder={t('Choose an admin or committee member')}
          options={staff.map((member) => ({
            value: member.user_id,
            label: member.full_name,
          }))}
        />
        <TextInput
          id={`${id}-due`}
          label={t('Due date')}
          name="dueDate"
          type="date"
          required
          defaultValue={objection?.due_date ?? today}
        />
        <TextInput
          id={`${id}-corrected`}
          label={t('Corrected on')}
          name="correctedOn"
          type="date"
          defaultValue={objection?.corrected_on ?? ''}
        />
      </div>
      <TextAreaInput
        id={`${id}-correction`}
        label={t('Correction note and evidence reference')}
        name="correctionNote"
        maxLength={4000}
        defaultValue={objection?.correction_note ?? ''}
      />
      <SelectInput
        id={`${id}-document`}
        label={t('P19 evidence document')}
        name="evidenceDocumentId"
        defaultValue={objection?.evidence_document_id ?? ''}
        options={[
          { value: '', label: t('No linked evidence') },
          ...documents.map((document) => ({
            value: document.id,
            label: document.title,
          })),
        ]}
      />
    </ModuleActionForm>
  );
}
