// Manage factual document-governance records inside the existing Documents workspace.
'use client';
import { useId, useState } from 'react';
import {
  DOCUMENT_GOVERNANCE_KINDS,
  DOCUMENT_GOVERNANCE_MILESTONE_KINDS,
  DOCUMENT_GOVERNANCE_MAINTENANCE_STATES,
  DOCUMENT_GOVERNANCE_SOURCE_KINDS,
  documentGovernanceArchiveInputSchema,
  documentGovernanceSaveInputSchema,
  documentSettingsInputSchema,
  type DocumentGovernanceKind,
  type DocumentGovernanceRecord,
  type DocumentGovernanceSource,
} from '@/core/document/validation';
import {
  saveGovernanceRecordAction,
  setGovernanceRecordArchivedAction,
  updateDocumentReminderSettingsAction,
} from '@/app/(admin)/admin/documents/actions';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { Card } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useDocumentPresentation } from './presentation';
import type { ModuleFormAction } from '@/components/ui/module-action-form';

export type GovernanceSelection = {
  kind: DocumentGovernanceKind;
  sourceKind: (typeof DOCUMENT_GOVERNANCE_SOURCE_KINDS)[number];
  sourceOffset: number;
  recordId?: string;
  archived: boolean;
  offset: number;
};

export type GovernanceHistory = {
  total: number;
  items: {
    id: string;
    action: 'create' | 'update' | 'verify' | 'archive' | 'restore';
    changedFields: string[];
    reason: string | null;
    createdAt: string;
    actorName: string | null;
    previousValues: Record<string, unknown>;
  }[];
};

export type GovernanceActions = {
  save: ModuleFormAction;
  archive: ModuleFormAction;
  settings: ModuleFormAction;
};

export const DEFAULT_GOVERNANCE_ACTIONS: GovernanceActions = {
  save: saveGovernanceRecordAction,
  archive: setGovernanceRecordArchivedAction,
  settings: updateDocumentReminderSettingsAction,
};

const KIND_LABELS: Record<DocumentGovernanceKind, string> = {
  validity: 'Validity and expiry',
  register: 'Register entry',
  amendment: 'Amendment milestone',
  house_rule: 'House rule',
};
const SOURCE_LABELS: Record<
  (typeof DOCUMENT_GOVERNANCE_SOURCE_KINDS)[number],
  string
> = {
  document_version: 'Document version',
  tenancy_noc: 'Tenancy NOC',
  meeting_resolution: 'Meeting decision',
};
const MAINTENANCE_LABELS: Record<
  (typeof DOCUMENT_GOVERNANCE_MAINTENANCE_STATES)[number],
  string
> = {
  not_started: 'Not started',
  maintained: 'Maintained',
  needs_review: 'Needs review',
  not_applicable: 'Not applicable',
};
const MILESTONE_LABELS: Record<
  (typeof DOCUMENT_GOVERNANCE_MILESTONE_KINDS)[number],
  string
> = {
  meeting: 'Meeting decision',
  filing: 'Filing or submission',
  registrar_approval: 'Registrar approval',
};
const GOVERNANCE_PAGE_SIZE = 25;
const linkClass =
  'inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus';

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function nullableText(form: FormData, name: string) {
  return text(form, name) || null;
}

function sourceOptions(
  sources: readonly DocumentGovernanceSource[],
  existing?: {
    id?: string | null;
    kind?: (typeof DOCUMENT_GOVERNANCE_SOURCE_KINDS)[number];
    label: string;
  },
) {
  const options = sources.map((source) => ({
    value: source.id,
    label: `${source.title}${source.fileName ? ` · ${source.fileName}` : ''}${
      source.versionNumber ? ` · version ${source.versionNumber}` : ''
    }${source.historical ? ' · historical' : ''}`,
  }));
  if (existing?.id && !options.some((option) => option.value === existing.id)) {
    options.unshift({
      value: existing.id,
      label: `${existing.label} (currently linked)`,
    });
  }
  return options;
}

function governanceHref(
  baseHref: string,
  selection: GovernanceSelection,
  changes: Partial<GovernanceSelection> = {},
) {
  const next = { ...selection, ...changes };
  const params = new URLSearchParams();
  params.set('governanceKind', next.kind);
  params.set('governanceSourceKind', next.sourceKind);
  if (next.sourceOffset)
    params.set('governanceSourceOffset', String(next.sourceOffset));
  if (next.recordId) params.set('governanceRecord', next.recordId);
  if (next.archived) params.set('governanceArchived', '1');
  if (next.offset) params.set('governanceOffset', String(next.offset));
  return `${baseHref}?${params.toString()}`;
}

function governanceDetails(kind: DocumentGovernanceKind, form: FormData) {
  if (kind === 'validity') {
    return {
      issuingAuthority: nullableText(form, 'issuingAuthority'),
      reference: nullableText(form, 'reference'),
      issueDate: nullableText(form, 'issueDate'),
      expiryKind: text(form, 'expiryKind') as 'unknown' | 'dated' | 'perpetual',
      expiryDate: nullableText(form, 'expiryDate'),
    };
  }
  if (kind === 'register') {
    return {
      name: nullableText(form, 'registerName'),
      type: nullableText(form, 'registerType'),
      basis: nullableText(form, 'basis'),
      maintenanceState: nullableText(form, 'maintenanceState') as
        (typeof DOCUMENT_GOVERNANCE_MAINTENANCE_STATES)[number] | null,
      clauseOrPage: nullableText(form, 'clauseOrPage'),
      format: nullableText(form, 'format'),
      physicalLocation: nullableText(form, 'physicalLocation'),
      custodian: nullableText(form, 'custodian'),
      reviewDate: nullableText(form, 'reviewDate'),
    };
  }
  if (kind === 'amendment') {
    return {
      milestoneType: text(form, 'milestoneType') as
        'meeting' | 'filing' | 'registrar_approval',
      milestoneDate: nullableText(form, 'milestoneDate'),
      note: nullableText(form, 'note'),
      historicalEvidence: form.get('historicalEvidence') === 'on',
    };
  }
  return {
    text: nullableText(form, 'ruleText'),
    approvalDate: nullableText(form, 'approvalDate'),
    effectiveDate: nullableText(form, 'effectiveDate'),
  };
}

function GovernanceRecordForm({
  kind,
  sourceKind,
  sources,
  decisionSources,
  record,
  action,
}: {
  kind: DocumentGovernanceKind;
  sourceKind: GovernanceSelection['sourceKind'];
  sources: readonly DocumentGovernanceSource[];
  decisionSources: readonly DocumentGovernanceSource[];
  record?: DocumentGovernanceRecord;
  action: ModuleFormAction;
}) {
  const { t } = useDocumentPresentation();
  const id = useId();
  const [state, setState] = useState<'draft' | 'verified'>(
    record?.state === 'verified' ? 'verified' : 'draft',
  );
  const [expiryKind, setExpiryKind] = useState<
    'unknown' | 'dated' | 'perpetual'
  >(record?.validity?.expiryKind ?? 'unknown');
  return (
    <ModuleActionForm
      action={action}
      idempotent={!record}
      submitLabel={t(record ? 'Save record' : 'Add record')}
      input={(form, clientRequestId) =>
        documentGovernanceSaveInputSchema.parse({
          recordId: record?.id ?? null,
          kind,
          title: text(form, 'title'),
          state,
          source: nullableText(form, 'sourceId')
            ? { kind: sourceKind, id: text(form, 'sourceId') }
            : null,
          approvingResolutionId:
            kind === 'house_rule'
              ? nullableText(form, 'approvingResolutionId')
              : null,
          details: governanceDetails(kind, form),
          expectedVersion: record?.version ?? null,
          reason: record ? nullableText(form, 'reason') : null,
          clientRequestId: clientRequestId ?? record?.id ?? crypto.randomUUID(),
        })
      }
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Record title')}
        required
        maxLength={160}
        defaultValue={record?.title ?? ''}
      />
      <SelectInput
        id={`${id}-state`}
        name="state"
        label={t('Record state')}
        value={state}
        onChange={(event) =>
          setState(event.target.value === 'verified' ? 'verified' : 'draft')
        }
        options={[
          { value: 'draft', label: t('Draft') },
          { value: 'verified', label: t('Verified fact') },
        ]}
        helpText={t(
          'Verified means the entered fact is backed by the linked evidence. It does not make a legal-compliance finding.',
        )}
      />
      <Banner title={t('Who can see this draft')}>
        {t(
          state === 'verified'
            ? 'Access follows every linked source. Removing or replacing evidence cannot recall information already viewed.'
            : 'A draft with no linked evidence is visible to administrators and committee members. Do not enter private information until you choose the right source.',
        )}
      </Banner>
      <SelectInput
        id={`${id}-source`}
        name="sourceId"
        label={t(`${SOURCE_LABELS[sourceKind]} evidence (optional for drafts)`)}
        defaultValue={record?.source.id ?? ''}
        placeholder={t('No linked evidence')}
        options={sourceOptions(sources, record?.source)}
      />
      {kind === 'house_rule' ? (
        <SelectInput
          id={`${id}-decision`}
          name="approvingResolutionId"
          label={t('Approving meeting decision')}
          defaultValue={record?.houseRule?.approvingResolutionId ?? ''}
          placeholder={t('Choose a decision')}
          options={sourceOptions(decisionSources, {
            id: record?.houseRule?.approvingResolutionId,
            label:
              record?.houseRule?.approvingResolutionLabel ??
              'Current meeting decision',
          })}
          helpText={t(
            'A passed decision is required only when this rule is published after the legal-review gate is separately opened.',
          )}
        />
      ) : null}
      {kind === 'validity' ? (
        <>
          <TextInput
            id={`${id}-authority`}
            name="issuingAuthority"
            label={t('Issuing authority (optional)')}
            maxLength={200}
            defaultValue={record?.validity?.issuingAuthority ?? ''}
          />
          <TextInput
            id={`${id}-reference`}
            name="reference"
            label={t('Reference (optional)')}
            maxLength={200}
            defaultValue={record?.validity?.reference ?? ''}
          />
          <TextInput
            id={`${id}-issue-date`}
            name="issueDate"
            type="date"
            label={t('Issue date (optional)')}
            defaultValue={record?.validity?.issueDate ?? ''}
          />
          <SelectInput
            id={`${id}-expiry-kind`}
            name="expiryKind"
            label={t('Expiry')}
            value={expiryKind}
            onChange={(event) =>
              setExpiryKind(
                event.target.value as 'unknown' | 'dated' | 'perpetual',
              )
            }
            options={[
              { value: 'unknown', label: t('Unknown') },
              { value: 'dated', label: t('Dated expiry') },
              { value: 'perpetual', label: t('Perpetual') },
            ]}
          />
          {expiryKind === 'dated' ? (
            <TextInput
              id={`${id}-expiry-date`}
              name="expiryDate"
              type="date"
              label={t('Expiry date')}
              required={state === 'verified'}
              defaultValue={record?.validity?.expiryDate ?? ''}
            />
          ) : (
            <input type="hidden" name="expiryDate" value="" />
          )}
        </>
      ) : null}
      {kind === 'register' ? (
        <>
          <TextInput
            id={`${id}-register-name`}
            name="registerName"
            label={t('Register name')}
            required={state === 'verified'}
            maxLength={160}
            defaultValue={record?.register?.name ?? ''}
          />
          <TextInput
            id={`${id}-register-type`}
            name="registerType"
            label={t('Society-entered register type')}
            required={state === 'verified'}
            maxLength={120}
            defaultValue={record?.register?.type ?? ''}
          />
          <TextAreaInput
            id={`${id}-basis`}
            name="basis"
            label={t('Source or applicability basis')}
            required={state === 'verified'}
            maxLength={500}
            defaultValue={record?.register?.basis ?? ''}
          />
          <SelectInput
            id={`${id}-maintenance`}
            name="maintenanceState"
            label={t('Recorded maintenance state (optional)')}
            defaultValue={record?.register?.maintenanceState ?? ''}
            placeholder={t('Not recorded')}
            options={DOCUMENT_GOVERNANCE_MAINTENANCE_STATES.map((value) => ({
              value,
              label: t(MAINTENANCE_LABELS[value]),
            }))}
          />
          <TextInput
            id={`${id}-clause`}
            name="clauseOrPage"
            label={t('Clause or page (optional)')}
            maxLength={200}
            defaultValue={record?.register?.clauseOrPage ?? ''}
          />
          <TextInput
            id={`${id}-format`}
            name="format"
            label={t('Format (optional)')}
            maxLength={200}
            defaultValue={record?.register?.format ?? ''}
          />
          <TextInput
            id={`${id}-location`}
            name="physicalLocation"
            label={t('Physical location — admin only (optional)')}
            maxLength={200}
            defaultValue={record?.register?.physicalLocation ?? ''}
          />
          <TextInput
            id={`${id}-custodian`}
            name="custodian"
            label={t('Custodian — admin only (optional)')}
            maxLength={200}
            defaultValue={record?.register?.custodian ?? ''}
          />
          <TextInput
            id={`${id}-review-date`}
            name="reviewDate"
            type="date"
            label={t('Review date (optional)')}
            defaultValue={record?.register?.reviewDate ?? ''}
          />
        </>
      ) : null}
      {kind === 'amendment' ? (
        <>
          <SelectInput
            id={`${id}-milestone`}
            name="milestoneType"
            label={t('Milestone')}
            defaultValue={record?.amendment?.milestoneType ?? 'meeting'}
            options={DOCUMENT_GOVERNANCE_MILESTONE_KINDS.map((value) => ({
              value,
              label: t(MILESTONE_LABELS[value]),
            }))}
          />
          <TextInput
            id={`${id}-milestone-date`}
            name="milestoneDate"
            type="date"
            label={t('Recorded date')}
            required={state === 'verified'}
            defaultValue={record?.amendment?.milestoneDate ?? ''}
          />
          <TextAreaInput
            id={`${id}-note`}
            name="note"
            label={t('Factual note (optional)')}
            maxLength={500}
            defaultValue={record?.amendment?.note ?? ''}
          />
          <CheckboxInput
            id={`${id}-historical`}
            name="historicalEvidence"
            label={t('This is retained historical evidence')}
            defaultChecked={record?.amendment?.historicalEvidence ?? false}
            description={t(
              'Use only for deliberately historical amendment evidence. It is not a current-document claim.',
            )}
          />
        </>
      ) : null}
      {kind === 'house_rule' ? (
        <>
          <TextAreaInput
            id={`${id}-rule-text`}
            name="ruleText"
            label={t('House-rule text')}
            required={state === 'verified'}
            maxLength={5000}
            defaultValue={record?.houseRule?.text ?? ''}
          />
          <TextInput
            id={`${id}-approval-date`}
            name="approvalDate"
            type="date"
            label={t('Recorded approval date (optional)')}
            defaultValue={record?.houseRule?.approvalDate ?? ''}
          />
          <TextInput
            id={`${id}-effective-date`}
            name="effectiveDate"
            type="date"
            label={t('Recorded effective date (optional)')}
            defaultValue={record?.houseRule?.effectiveDate ?? ''}
          />
          <Banner title={t('Publishing is locked')} tone="warning">
            {t(
              'Draft and factual verification controls are available, but no society can publish. Qualified legal review and a separately approved unlock are required.',
            )}
          </Banner>
        </>
      ) : null}
      {record ? (
        <TextAreaInput
          id={`${id}-reason`}
          name="reason"
          label={t('Reason for correction')}
          required
          maxLength={500}
        />
      ) : null}
    </ModuleActionForm>
  );
}

function GovernanceArchiveForm({
  record,
  action,
}: {
  record: DocumentGovernanceRecord;
  action: ModuleFormAction;
}) {
  const { t } = useDocumentPresentation();
  const id = useId();
  const archived = record.archivedAt !== null;
  const nextArchived = !archived;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t(archived ? 'Restore record' : 'Archive record')}
      input={(form) =>
        documentGovernanceArchiveInputSchema.parse({
          recordId: record.id,
          archived: nextArchived,
          expectedVersion: record.version,
          reason: text(form, 'reason'),
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t(archived ? 'Reason for restore' : 'Reason for archive')}
        required
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

function GovernanceRecordSummary({
  record,
  canManage,
  selection,
  baseHref,
}: {
  record: DocumentGovernanceRecord;
  canManage: boolean;
  selection: GovernanceSelection;
  baseHref: string;
}) {
  const { t, date } = useDocumentPresentation();
  const sourceState =
    record.source.state === 'needs_review'
      ? t('Needs review')
      : record.source.state === 'unlinked'
        ? t('No linked evidence')
        : t('Source available');
  const displayedState =
    record.source.state === 'needs_review' ||
    record.houseRule?.decisionState === 'needs_review'
      ? 'Needs review'
      : record.archivedAt
        ? 'Archived'
        : record.state === 'verified'
          ? 'Verified fact'
          : record.state === 'needs_review'
            ? 'Needs review'
            : 'Draft';
  return (
    <li className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h3 className="text-body-strong break-words">{record.title}</h3>
          <p className="text-caption text-ink-muted">
            {t(KIND_LABELS[record.kind])} · {t(displayedState)}
          </p>
        </div>
        {canManage ? (
          <a
            className={linkClass}
            href={governanceHref(baseHref, selection, {
              kind: record.kind,
              recordId: record.id,
            })}
          >
            {t('Edit and history')}
          </a>
        ) : null}
      </div>
      <p className="text-body">
        {t('Evidence: {label} · {state}', {
          label: record.source.label,
          state: sourceState,
        })}
      </p>
      {record.validity ? (
        <p className="text-caption text-ink-muted">
          {t(
            record.validity.dateState === 'due_today'
              ? 'Due today — {date}'
              : record.validity.dateState === 'past_date'
                ? 'Past date — {date}'
                : record.validity.dateState === 'upcoming'
                  ? 'Upcoming — {date}'
                  : record.validity.expiryKind === 'perpetual'
                    ? 'Recorded as perpetual'
                    : 'Expiry unknown',
            {
              date:
                record.validity.expiryDate === null
                  ? ''
                  : date(`${record.validity.expiryDate}T00:00:00+05:30`),
            },
          )}
        </p>
      ) : null}
      {record.register ? (
        <div className="grid gap-space-1 text-caption text-ink-muted">
          {record.register.name ? <p>{record.register.name}</p> : null}
          {record.register.physicalLocation ? (
            <p>
              {t('Location: {value}', {
                value: record.register.physicalLocation,
              })}
            </p>
          ) : null}
          {record.register.custodian ? (
            <p>
              {t('Custodian: {value}', { value: record.register.custodian })}
            </p>
          ) : null}
        </div>
      ) : null}
      {record.amendment?.milestoneDate ? (
        <p className="text-caption text-ink-muted">
          {t('Recorded milestone {date}', {
            date: date(`${record.amendment.milestoneDate}T00:00:00+05:30`),
          })}
        </p>
      ) : null}
      {record.houseRule ? (
        <div className="grid gap-space-1 text-caption text-ink-muted">
          <p>{t('Publication locked')}</p>
          <p>
            {t(
              record.houseRule.decisionState === 'available'
                ? 'Approving decision available'
                : 'Approving decision needs review',
            )}
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function DocumentGovernanceWorkspace({
  records,
  total,
  detail,
  history,
  sources,
  decisionSources,
  selection,
  baseHref,
  canManage,
  writable,
  settings,
  canEditSettings = true,
  tenancyEnabled,
  meetingEnabled,
  actions = DEFAULT_GOVERNANCE_ACTIONS,
}: {
  records: readonly DocumentGovernanceRecord[];
  total: number;
  detail: DocumentGovernanceRecord | null;
  history: GovernanceHistory | null;
  sources: { total: number; items: readonly DocumentGovernanceSource[] };
  decisionSources: readonly DocumentGovernanceSource[];
  selection: GovernanceSelection;
  baseHref: string;
  canManage: boolean;
  writable: boolean;
  settings: { expiryRemindersEnabled: boolean };
  canEditSettings?: boolean;
  tenancyEnabled: boolean;
  meetingEnabled: boolean;
  actions?: GovernanceActions;
}) {
  const { t, date } = useDocumentPresentation();
  const id = useId();
  const sourceKindOptions = DOCUMENT_GOVERNANCE_SOURCE_KINDS.filter(
    (value) =>
      value !== 'meeting_resolution' ||
      selection.kind === 'amendment' ||
      selection.kind === 'house_rule',
  ).filter((value) => value !== 'tenancy_noc' || tenancyEnabled);
  const previousOffset = Math.max(0, selection.offset - GOVERNANCE_PAGE_SIZE);
  const nextOffset = selection.offset + GOVERNANCE_PAGE_SIZE;
  const previousSourceOffset = Math.max(
    0,
    selection.sourceOffset - GOVERNANCE_PAGE_SIZE,
  );
  const nextSourceOffset = selection.sourceOffset + GOVERNANCE_PAGE_SIZE;
  return (
    <section className="grid gap-space-5" aria-labelledby="governance-title">
      <header className="grid gap-space-2">
        <h2 id="governance-title" className="text-heading">
          {t('Document governance records')}
        </h2>
        <p className="text-body text-ink-muted">
          {t(
            'Factual certificate, register, amendment and house-rule records linked to existing evidence.',
          )}
        </p>
      </header>
      <Banner title={t('No legal-compliance claim')} tone="warning">
        {t(
          'A recorded date, source, vote, filing or approval is not a determination of legal effect, completeness or compliance.',
        )}
      </Banner>
      {canManage && !writable ? (
        <Banner title={t('Changes are paused')} tone="warning">
          {t('Records remain available, but this society is read-only.')}
        </Banner>
      ) : null}
      <Card
        title={t('Records')}
        description={t(
          'Committee members see ordinary details only when every linked source is available to them.',
        )}
      >
        <div className="grid gap-space-4">
          <div className="flex flex-wrap gap-space-4">
            <a
              className={linkClass}
              href={governanceHref(baseHref, selection, {
                archived: !selection.archived,
                offset: 0,
                recordId: undefined,
              })}
            >
              {t(
                selection.archived
                  ? 'Hide archived records'
                  : 'Show archived records',
              )}
            </a>
          </div>
          {records.length === 0 ? (
            <EmptyState
              title={t('No governance records yet')}
              description={t(
                canManage
                  ? 'Choose a record kind and source below to create the first factual record.'
                  : 'Authorized records will appear here.',
              )}
            />
          ) : (
            <ul className="grid gap-space-3">
              {records.map((record) => (
                <GovernanceRecordSummary
                  key={record.id}
                  record={record}
                  canManage={canManage}
                  selection={selection}
                  baseHref={baseHref}
                />
              ))}
            </ul>
          )}
          {total > GOVERNANCE_PAGE_SIZE ? (
            <nav
              aria-label={t('Governance record pages')}
              className="flex flex-wrap gap-space-4"
            >
              {selection.offset > 0 ? (
                <a
                  className={linkClass}
                  href={governanceHref(baseHref, selection, {
                    offset: previousOffset,
                    recordId: undefined,
                  })}
                >
                  {t('Previous records')}
                </a>
              ) : null}
              {nextOffset < total ? (
                <a
                  className={linkClass}
                  href={governanceHref(baseHref, selection, {
                    offset: nextOffset,
                    recordId: undefined,
                  })}
                >
                  {t('Next records')}
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
      </Card>
      {canManage ? (
        <>
          <Card title={t('Choose evidence')}>
            <div className="grid gap-space-4">
              <form method="get" action={baseHref} className="grid gap-space-3">
                <SelectInput
                  id={`${id}-kind-filter`}
                  name="governanceKind"
                  label={t('Record kind')}
                  defaultValue={selection.kind}
                  options={DOCUMENT_GOVERNANCE_KINDS.map((value) => ({
                    value,
                    label: t(KIND_LABELS[value]),
                  }))}
                />
                <SelectInput
                  id={`${id}-source-filter`}
                  name="governanceSourceKind"
                  label={t('Evidence type')}
                  defaultValue={
                    selection.kind === 'house_rule'
                      ? 'document_version'
                      : selection.sourceKind
                  }
                  disabled={selection.kind === 'house_rule'}
                  options={sourceKindOptions.map((value) => ({
                    value,
                    label: t(SOURCE_LABELS[value]),
                  }))}
                />
                <Button type="submit" variant="secondary">
                  {t('Load source choices')}
                </Button>
              </form>
              {!meetingEnabled &&
              (selection.sourceKind === 'meeting_resolution' ||
                selection.kind === 'house_rule') ? (
                <Banner title={t('Meetings is off')} tone="warning">
                  {t(
                    'Turn on Meetings before choosing a decision source. Existing related records and history are hidden while it is off.',
                  )}
                </Banner>
              ) : sources.total === 0 ? (
                <EmptyState
                  title={t('No authorized evidence in this page')}
                  description={t(
                    selection.kind === 'amendment'
                      ? 'Add or link an authorized document, NOC or meeting decision, or change the source type.'
                      : 'Choose another source type or publish an eligible source in Documents first.',
                  )}
                />
              ) : (
                <p className="text-caption text-ink-muted">
                  {t(
                    '{total} authorized {kind} sources found. Showing this 25-source page.',
                    {
                      total: sources.total,
                      kind: t(SOURCE_LABELS[selection.sourceKind]),
                    },
                  )}
                </p>
              )}
              {sources.total > GOVERNANCE_PAGE_SIZE ? (
                <nav
                  aria-label={t('Evidence pages')}
                  className="flex flex-wrap gap-space-4"
                >
                  {selection.sourceOffset > 0 ? (
                    <a
                      className={linkClass}
                      href={governanceHref(baseHref, selection, {
                        sourceOffset: previousSourceOffset,
                      })}
                    >
                      {t('Previous evidence')}
                    </a>
                  ) : null}
                  {nextSourceOffset < sources.total ? (
                    <a
                      className={linkClass}
                      href={governanceHref(baseHref, selection, {
                        sourceOffset: nextSourceOffset,
                      })}
                    >
                      {t('Next evidence')}
                    </a>
                  ) : null}
                </nav>
              ) : null}
            </div>
          </Card>
          {writable ? (
            <Card
              title={t(
                detail ? 'Edit governance record' : 'Add governance record',
              )}
              description={t(KIND_LABELS[selection.kind])}
            >
              <GovernanceRecordForm
                key={`${selection.kind}-${selection.sourceKind}-${detail?.version ?? 'new'}`}
                kind={selection.kind}
                sourceKind={selection.sourceKind}
                sources={sources.items}
                decisionSources={decisionSources}
                record={detail ?? undefined}
                action={actions.save}
              />
            </Card>
          ) : null}
          {detail ? (
            <Card title={t('Private history')}>
              <div className="grid gap-space-4">
                {history?.items.length ? (
                  <ol className="grid gap-space-3">
                    {history.items.map((revision) => (
                      <li
                        key={revision.id}
                        className="grid gap-space-1 rounded-md border border-rule p-space-3"
                      >
                        <p className="text-body-strong">
                          {revision.actorName ?? t('Administrator')} ·{' '}
                          {t(revision.action)}
                        </p>
                        <p className="text-caption text-ink-muted">
                          {date(revision.createdAt)}
                        </p>
                        {revision.reason ? (
                          <p className="text-body break-words">
                            {revision.reason}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    title={t('No history yet')}
                    description={t(
                      'Corrections and archive changes will appear here.',
                    )}
                  />
                )}
                {writable ? (
                  <GovernanceArchiveForm
                    record={detail}
                    action={actions.archive}
                  />
                ) : null}
              </div>
            </Card>
          ) : null}
          {canEditSettings ? (
            <Card
              title={t('Expiry reminders')}
              description={t(
                'Off by default. In-app notifications go only to active administrators at 30, 7 and 0 days. No email, SMS or push.',
              )}
            >
              <ModuleActionForm
                action={actions.settings}
                submitLabel={t('Save reminder setting')}
                input={(form) =>
                  documentSettingsInputSchema.parse({
                    expiryRemindersEnabled:
                      form.get('expiryRemindersEnabled') === 'on',
                  })
                }
              >
                <CheckboxInput
                  id={`${id}-reminders`}
                  name="expiryRemindersEnabled"
                  label={t('Enable document-expiry in-app reminders')}
                  defaultChecked={settings.expiryRemindersEnabled}
                  description={t(
                    'A missed schedule sends one catch-up for the latest crossed milestone. If no active administrator can receive it, it stays pending.',
                  )}
                />
              </ModuleActionForm>
            </Card>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
