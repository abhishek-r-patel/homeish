// Present privacy-scoped case stages, decisions, dues, handovers and certificates.
'use client';

import { useId, useState } from 'react';
import { z } from 'zod';
import {
  advanceTransferCaseAction,
  approveClearanceHandoverAction,
  consentClearanceHandoverAction,
  draftClearanceHandoverAction,
  issueTenancyCertificateAction,
  recordTransferDecisionAction,
  saveTransferCaseAction,
  supersedeTenancyCertificateAction,
} from '@/app/(resident)/tenancy/actions';
import type { TenancyWorkspace } from '@/core/tenancy/moves/validation';
import {
  advanceTransferCaseInputSchema,
  certificatePrepareInputSchema,
  certificateSupersedeInputSchema,
  clearanceConsentInputSchema,
  clearanceHandoverActionInputSchema,
  clearanceHandoverDraftInputSchema,
  transferDecisionInputSchema,
  transferDecisionSchema,
  transferStageSchema,
  transferCaseInputSchema,
  type ClearanceDues,
  type TransferCaseDetail,
} from '@/core/tenancy/transfers/validation';
import {
  CERTIFICATE_KIND_LABELS,
  TRANSFER_DECISION_LABELS,
  TRANSFER_STAGE_LABELS,
} from '@/core/tenancy/transfers/presentation';
import { Banner } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { useTenancyPresentation } from './presentation';
import {
  ClearanceAgreementUpload,
  TransferDocumentLink,
} from './transfer-files';

export function ClearanceDuesPanel({
  dues,
  timezone,
}: {
  dues: ClearanceDues | null;
  timezone: string;
}) {
  const { t, time, balance } = useTenancyPresentation();
  if (!dues) return null;
  if (dues.status === 'not_checked') {
    return (
      <Banner title={t('Dues: Not checked')} tone="warning">
        {t(
          'Billing is disabled. This is not a clearance or a zero balance. The certificate will say dues were not checked.',
        )}
      </Banner>
    );
  }
  return (
    <Banner
      title={t(dues.status === 'owed' ? 'Dues outstanding' : 'No dues')}
      tone={dues.status === 'owed' ? 'danger' : 'success'}
    >
      <p>
        {t('Authoritative total: {amount}.', {
          amount: balance(dues.total_paise ?? '0'),
        })}
      </p>
      <p>
        {t('Checked: {date}.', {
          date: time(dues.checked_at!, timezone),
        })}
      </p>
      {dues.bills.length ? (
        <ul className="list-disc pl-space-5">
          {dues.bills.map((bill) => (
            <li key={bill.bill_id}>
              {bill.number}: {balance(bill.outstanding_paise)}
            </li>
          ))}
        </ul>
      ) : null}
    </Banner>
  );
}

function DecisionForm({
  detail,
  action = recordTransferDecisionAction,
}: {
  detail: TransferCaseDetail;
  action?: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const [decision, setDecision] = useState<
    z.infer<typeof transferDecisionSchema>
  >(detail.decision?.decision ?? 'approved');
  const [reference, setReference] = useState(
    detail.decision?.resolution_reference ?? '',
  );
  const [resolutionDate, setResolutionDate] = useState(
    detail.decision?.resolution_date ?? detail.case.received_on,
  );
  const [condition, setCondition] = useState('');
  const [responsible, setResponsible] = useState('');
  const [followUp, setFollowUp] = useState('');
  return (
    <ModuleActionForm
      action={action}
      confirmMessage={t(
        'Issue this numbered certificate after a fresh dues recheck and exact PDF verification?',
      )}
      idempotent
      submitDisabled={!reference || !resolutionDate}
      submitLabel={t(detail.decision ? 'Update Decision' : 'Record Decision')}
      input={(_, clientRequestId) =>
        transferDecisionInputSchema.parse({
          caseId: detail.case.id,
          decision,
          resolutionReference: reference,
          resolutionDate,
          meetingId: null,
          conditions:
            decision === 'approved_with_conditions'
              ? [
                  {
                    text: condition,
                    responsible,
                    follow_up_on: followUp || null,
                    done: false,
                  },
                ]
              : [],
          expectedVersion: detail.decision?.version ?? null,
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-decision`}
        label={t('Committee decision')}
        onChange={(event) =>
          setDecision(transferDecisionSchema.parse(event.currentTarget.value))
        }
        options={transferDecisionSchema.options.map((value) => ({
          value,
          label: t(TRANSFER_DECISION_LABELS[value]),
        }))}
        value={decision}
      />
      <TextInput
        id={`${id}-reference`}
        label={t('Resolution reference')}
        onChange={(event) => setReference(event.currentTarget.value)}
        required
        value={reference}
      />
      <DatePicker
        id={`${id}-date`}
        label={t('Resolution date')}
        onChange={setResolutionDate}
        value={resolutionDate}
      />
      {decision === 'approved_with_conditions' ? (
        <>
          <TextInput
            id={`${id}-condition`}
            label={t('Condition')}
            onChange={(event) => setCondition(event.currentTarget.value)}
            required
            value={condition}
          />
          <TextInput
            id={`${id}-responsible`}
            label={t('Responsible party')}
            onChange={(event) => setResponsible(event.currentTarget.value)}
            required
            value={responsible}
          />
          <DatePicker
            id={`${id}-follow`}
            label={t('Follow-up date (optional)')}
            onChange={setFollowUp}
            value={followUp}
          />
        </>
      ) : null}
    </ModuleActionForm>
  );
}

function HandoverDraftForm({
  detail,
  action = draftClearanceHandoverAction,
}: {
  detail: TransferCaseDetail;
  action?: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const parties = detail.parties.filter((party) => party.active);
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '');
  const [note, setNote] = useState('');
  const party = parties.find((item) => item.id === partyId);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitDisabled={!party}
      submitLabel={t('Draft Conditional Handover')}
      input={(_, clientRequestId) =>
        clearanceHandoverDraftInputSchema.parse({
          moveId: null,
          caseId: detail.case.id,
          responsibleTransferPartyId: party?.id ?? null,
          responsibleMembershipId: null,
          responsibleRole: party?.role,
          adminNote: note || null,
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-party`}
        label={t('Party responsible for unpaid dues')}
        onChange={(event) => setPartyId(event.currentTarget.value)}
        options={parties.map((item) => ({
          value: item.id,
          label: `${item.name} (${item.role})`,
        }))}
        value={partyId}
      />
      <TextInput
        id={`${id}-note`}
        helpText={t(
          'Required only when the society uses administrator-note evidence.',
        )}
        label={t('Agreement evidence note')}
        onChange={(event) => setNote(event.currentTarget.value)}
        value={note}
      />
    </ModuleActionForm>
  );
}

function CertificateForm({
  detail,
  action = issueTenancyCertificateAction,
}: {
  detail: TransferCaseDetail;
  action?: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const [purpose, setPurpose] = useState(
    'Owner transfer clearance application',
  );
  const [designation, setDesignation] = useState('');
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitDisabled={!purpose || !designation}
      submitLabel={t('Issue Numbered Certificate')}
      input={(_, clientRequestId) =>
        certificatePrepareInputSchema.parse({
          moveId: null,
          caseId: detail.case.id,
          purpose,
          signatoryDesignation: designation,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-purpose`}
        label={t('Certificate purpose')}
        onChange={(event) => setPurpose(event.currentTarget.value)}
        required
        value={purpose}
      />
      <TextInput
        id={`${id}-designation`}
        label={t('Signatory designation')}
        onChange={(event) => setDesignation(event.currentTarget.value)}
        required
        value={designation}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'The kind is derived from a new dues check. The next number is allocated only after the exact PDF is attested and issued.',
        )}
      </p>
      <Banner title={t('Certificate preview')} tone="neutral">
        <p>
          {t(
            'Number: NOC/{financial year}/next sequence (allocated only on final issue).',
          )}
        </p>
        <p>
          {t(
            'This certificate records the purpose, active case parties, unit and authoritative dues result as of issue. It is not legal advice or proof of transfer of legal title.',
          )}
        </p>
      </Banner>
    </ModuleActionForm>
  );
}

function CaseEditForm({
  detail,
  workspace,
}: {
  detail: TransferCaseDetail;
  workspace: TenancyWorkspace;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const active = detail.parties.filter((party) => party.active);
  const buyer = active.find((party) => party.role === 'buyer');
  const availableOwners = workspace.occupancies.filter(
    (occupancy) =>
      occupancy.unit_id === detail.case.unit_id &&
      !occupancy.is_tenant &&
      occupancy.status === 'active',
  );
  const [sellers, setSellers] = useState(
    active
      .filter((party) => party.role === 'seller' && party.membership_id)
      .map((party) => party.membership_id!),
  );
  const [buyerName, setBuyerName] = useState(buyer?.name ?? '');
  const [phone, setPhone] = useState(buyer?.phone ?? '');
  const [email, setEmail] = useState(buyer?.email ?? '');
  const [receivedOn, setReceivedOn] = useState(detail.case.received_on);
  return (
    <Card title={t('Edit transfer case')}>
      <ModuleActionForm
        action={saveTransferCaseAction}
        idempotent
        submitDisabled={!buyerName.trim() || sellers.length === 0}
        submitLabel={t('Save Case Changes')}
        input={(_, clientRequestId) =>
          transferCaseInputSchema.parse({
            caseId: detail.case.id,
            unitId: detail.case.unit_id,
            receivedOn,
            sellers: sellers.map((membershipId) => ({ membershipId })),
            buyer: {
              name: buyerName,
              membershipId: buyer?.membership_id ?? null,
              phone: phone || null,
              email: email || null,
            },
            expectedVersion: detail.case.version,
            clientRequestId,
          })
        }
      >
        <DatePicker
          id={`${id}-received`}
          label={t('Received date')}
          max={workspace.today}
          onChange={setReceivedOn}
          value={receivedOn}
        />
        <p className="text-body-strong">
          {t('Current active owners (sellers)')}
        </p>
        {availableOwners.map((owner) => (
          <label
            className="flex min-h-12 items-center gap-space-2"
            key={owner.membership_id}
          >
            <input
              checked={sellers.includes(owner.membership_id)}
              onChange={(event) =>
                setSellers((current) =>
                  event.currentTarget.checked
                    ? [...current, owner.membership_id]
                    : current.filter((id) => id !== owner.membership_id),
                )
              }
              type="checkbox"
            />
            {workspace.tenants.find(
              (tenant) => tenant.id === owner.membership_id,
            )?.name ?? owner.membership_id}
          </label>
        ))}
        <TextInput
          id={`${id}-buyer`}
          label={t('Buyer name')}
          onChange={(event) => setBuyerName(event.currentTarget.value)}
          required
          value={buyerName}
        />
        <TextInput
          id={`${id}-phone`}
          label={t('Buyer phone (optional)')}
          onChange={(event) => setPhone(event.currentTarget.value)}
          type="tel"
          value={phone}
        />
        <TextInput
          id={`${id}-email`}
          label={t('Buyer email (optional)')}
          onChange={(event) => setEmail(event.currentTarget.value)}
          type="email"
          value={email}
        />
      </ModuleActionForm>
    </Card>
  );
}

function SupersedeForm({ detail }: { detail: TransferCaseDetail }) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const [reason, setReason] = useState('');
  const current = detail.certificates.at(-1);
  const previous = detail.certificates.at(-2);
  if (!current || !previous) return null;
  return (
    <ModuleActionForm
      action={supersedeTenancyCertificateAction}
      confirmMessage={t(
        'Mark this earlier certificate superseded? The original PDF will remain unchanged.',
      )}
      submitDisabled={!reason.trim()}
      submitLabel={t('Mark Earlier Certificate Superseded')}
      input={() =>
        certificateSupersedeInputSchema.parse({
          certificateId: previous.id,
          replacementCertificateId: current.id,
          reason,
        })
      }
    >
      <TextInput
        id={`${id}-reason`}
        label={t('Correction reason')}
        onChange={(event) => setReason(event.currentTarget.value)}
        required
        value={reason}
      />
    </ModuleActionForm>
  );
}

function CloseCaseForm({ detail }: { detail: TransferCaseDetail }) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const [stage, setStage] = useState<'rejected' | 'withdrawn'>('withdrawn');
  const [reason, setReason] = useState('');
  return (
    <ModuleActionForm
      action={advanceTransferCaseAction}
      confirmMessage={t(
        'Close this transfer case with the entered status and reason? History will be preserved.',
      )}
      submitDisabled={!reason.trim()}
      submitLabel={t(stage === 'withdrawn' ? 'Withdraw Case' : 'Reject Case')}
      input={() =>
        advanceTransferCaseInputSchema.parse({
          caseId: detail.case.id,
          expectedVersion: detail.case.version,
          nextStage: stage,
          reason,
        })
      }
    >
      <SelectInput
        id={`${id}-close`}
        label={t('Close case as')}
        onChange={(event) =>
          setStage(
            z.enum(['rejected', 'withdrawn']).parse(event.currentTarget.value),
          )
        }
        options={[
          { value: 'withdrawn', label: t('Withdrawn') },
          { value: 'rejected', label: t('Rejected') },
        ]}
        value={stage}
      />
      <TextInput
        id={`${id}-reason`}
        label={t('Closing reason')}
        onChange={(event) => setReason(event.currentTarget.value)}
        required
        value={reason}
      />
    </ModuleActionForm>
  );
}

export function TransferCaseView({
  detail,
  dues,
  workspace,
  mode,
  baseHref,
}: {
  detail: TransferCaseDetail;
  dues: ClearanceDues | null;
  workspace: TenancyWorkspace;
  mode: 'admin' | 'committee' | 'own';
  baseHref: string;
}) {
  const { t, date } = useTenancyPresentation();
  const activeParties = detail.parties.filter((party) => party.active);
  const editable = mode === 'admin' && workspace.can_write;
  const nextStages: Record<string, string> = {
    received: 'documents_checked',
    documents_checked: 'committee_decision',
    committee_decision: 'dues_settled',
    dues_settled: 'completed',
  };
  const next = nextStages[detail.case.stage];
  return (
    <section className="grid min-w-0 gap-space-5">
      <a className="min-h-12 text-brand underline" href={baseHref}>
        {t('Back to transfer cases')}
      </a>
      <header>
        <h1 className="text-title font-semibold">{t('Transfer case')}</h1>
        <p className="text-body text-ink-muted">
          {t(TRANSFER_STAGE_LABELS[detail.case.stage])} ·{' '}
          {t('{count} days elapsed', {
            count: Math.max(
              0,
              Math.floor(
                (Date.parse(`${workspace.today}T00:00:00Z`) -
                  Date.parse(`${detail.case.received_on}T00:00:00Z`)) /
                  86_400_000,
              ),
            ),
          })}
        </p>
      </header>
      <Card title={t('Stage tracker')}>
        <ol className="grid gap-space-2">
          {transferStageSchema.options
            .filter((stage) => stage !== 'rejected' && stage !== 'withdrawn')
            .map((stage) => (
              <li
                className={`rounded-md border p-space-3 ${detail.case.stage === stage ? 'border-brand bg-brand-tint' : 'border-rule'}`}
                key={stage}
              >
                {t(TRANSFER_STAGE_LABELS[stage])}
              </li>
            ))}
        </ol>
        {detail.case.closing_reason ? (
          <p className="text-body">
            {t('Closing reason')}: {detail.case.closing_reason}
          </p>
        ) : null}
        {editable && next ? (
          <ModuleActionForm
            action={advanceTransferCaseAction}
            confirmMessage={t(
              'Advance this transfer case to the next stage? The current authoritative dues are checked where required.',
            )}
            submitLabel={t('Advance to {stage}', {
              stage: t(
                TRANSFER_STAGE_LABELS[
                  next as keyof typeof TRANSFER_STAGE_LABELS
                ],
              ),
            })}
            input={() =>
              advanceTransferCaseInputSchema.parse({
                caseId: detail.case.id,
                expectedVersion: detail.case.version,
                nextStage: next,
                reason: null,
              })
            }
          >
            <p className="text-caption text-ink-muted">
              {t(
                'Each stage moves forward only. Dues are checked again before dues-settled and completion.',
              )}
            </p>
          </ModuleActionForm>
        ) : null}
      </Card>
      {editable &&
      ['received', 'documents_checked'].includes(detail.case.stage) ? (
        <CaseEditForm detail={detail} workspace={workspace} />
      ) : null}
      {editable &&
      !['completed', 'rejected', 'withdrawn'].includes(detail.case.stage) ? (
        <Card title={t('Close case')}>
          <p className="text-caption text-ink-muted">
            {t('Closing preserves the case and history. A reason is required.')}
          </p>
          <CloseCaseForm detail={detail} />
        </Card>
      ) : null}
      <Card title={t('Parties')}>
        {activeParties.map((party) => (
          <p className="text-body" key={party.id}>
            <strong>{t(party.role === 'seller' ? 'Seller' : 'Buyer')}:</strong>{' '}
            {party.name}
            {mode === 'admin' && (party.phone || party.email)
              ? ` · ${party.phone ?? ''} ${party.email ?? ''}`
              : ''}
          </p>
        ))}
      </Card>
      <ClearanceDuesPanel dues={dues} timezone={workspace.timezone} />
      <Card title={t('Committee decision')}>
        {detail.decision ? (
          <div className="grid gap-space-2">
            <p className="text-body-strong">
              {t(TRANSFER_DECISION_LABELS[detail.decision.decision])}
            </p>
            <p className="text-body">
              {detail.decision.resolution_reference} ·{' '}
              {date(detail.decision.resolution_date)}
            </p>
            {detail.decision.conditions.map((condition, index) => (
              <p className="text-body" key={index}>
                {condition.done ? '✓' : '○'} {condition.text} —{' '}
                {condition.responsible}
                {condition.follow_up_on
                  ? ` · ${date(condition.follow_up_on)}`
                  : ''}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No committee decision recorded.')}
          </p>
        )}
        {editable ? <DecisionForm detail={detail} /> : null}
      </Card>
      <Card title={t('Conditional handovers')}>
        {dues?.status === 'owed' ? (
          <p className="text-body">
            {t(
              'A handover does not pay, waive or erase money owed. The current dues check is authoritative.',
            )}
          </p>
        ) : null}
        {detail.handovers.map((handover) => (
          <div
            className="mt-space-3 grid gap-space-3 rounded-md border border-rule p-space-3"
            key={handover.id}
          >
            <p className="text-body-strong">
              {t(handover.status)} · {t(handover.basis)} ·{' '}
              {t(handover.evidence_mode)}
            </p>
            <p className="text-caption text-ink-muted">
              {handover.approval_reference ?? t('Draft; not approved')}
            </p>
            {editable && handover.status === 'draft' ? (
              <>
                {handover.evidence_mode !== 'admin_note'
                  ? activeParties.map((party) => (
                      <ClearanceAgreementUpload
                        coveredMembershipId={party.membership_id}
                        coveredTransferPartyId={
                          party.membership_id ? null : party.id
                        }
                        handover={handover}
                        key={party.id}
                      />
                    ))
                  : null}
                <ModuleActionForm
                  action={approveClearanceHandoverAction}
                  confirmMessage={t(
                    'Approve this conditional handover? Current dues and evidence are rechecked, and unit money remains unpaid.',
                  )}
                  submitLabel={t('Approve Handover')}
                  input={() =>
                    clearanceHandoverActionInputSchema.parse({
                      handoverId: handover.id,
                      expectedVersion: handover.version,
                      approvalReference: `${detail.case.id.slice(0, 8)}-HANDOVER`,
                    })
                  }
                >
                  <p className="text-caption text-ink-muted">
                    {t(
                      'The application blocks approval until current dues and configured evidence pass.',
                    )}
                  </p>
                </ModuleActionForm>
              </>
            ) : null}
            {mode === 'own' && handover.status === 'draft' ? (
              <ModuleActionForm
                action={consentClearanceHandoverAction}
                submitLabel={t('Consent to Handover')}
                input={() =>
                  clearanceConsentInputSchema.parse({
                    handoverId: handover.id,
                    expectedVersion: handover.version,
                  })
                }
              >
                <p className="text-caption text-ink-muted">
                  {t('This confirms the exact displayed handover version.')}
                </p>
              </ModuleActionForm>
            ) : null}
          </div>
        ))}
        {editable && dues?.status === 'owed' ? (
          <HandoverDraftForm detail={detail} />
        ) : null}
        {mode !== 'committee'
          ? detail.files.map((file) => (
              <TransferDocumentLink
                key={file.id}
                label={t('signed agreement')}
                path={file.path}
              />
            ))
          : null}
      </Card>
      <Card title={t('Numbered certificates')}>
        {detail.certificates.length ? (
          detail.certificates.map((certificate) => (
            <div
              className="grid gap-space-2 border-b border-rule pb-space-3"
              key={certificate.id}
            >
              <p className="text-body-strong">
                {certificate.number} ·{' '}
                {t(CERTIFICATE_KIND_LABELS[certificate.kind])}
              </p>
              <p className="text-caption text-ink-muted">
                {date(certificate.issued_at.slice(0, 10))}
                {certificate.superseded_by ? t(' · Superseded') : ''}
              </p>
              {certificate.path && mode !== 'committee' ? (
                <TransferDocumentLink
                  label={certificate.number}
                  path={certificate.path}
                />
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-body text-ink-muted">
            {t('No numbered certificate has been issued.')}
          </p>
        )}
        {editable && detail.case.stage === 'completed' ? (
          <>
            <CertificateForm detail={detail} />
            <SupersedeForm detail={detail} />
          </>
        ) : null}
      </Card>
      {detail.revisions.length ? (
        <Card title={t('Edit history')}>
          {detail.revisions.map((revision) => (
            <p className="text-caption text-ink-muted" key={revision.id}>
              {revision.action} · {revision.changed_fields.join(', ')}
              {revision.reason ? ` · ${revision.reason}` : ''}
            </p>
          ))}
        </Card>
      ) : null}
    </section>
  );
}
