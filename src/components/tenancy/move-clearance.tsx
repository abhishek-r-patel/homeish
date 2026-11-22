// Extend P18 move detail with conditional handover and new numbered-certificate controls.
'use client';

import { useId, useState } from 'react';
import {
  approveClearanceHandoverAction,
  consentClearanceHandoverAction,
  draftClearanceHandoverAction,
  issueTenancyCertificateAction,
} from '@/app/(resident)/tenancy/actions';
import type {
  TenancyMoveDetail,
  TenancyWorkspace,
} from '@/core/tenancy/moves/validation';
import {
  certificatePrepareInputSchema,
  clearanceConsentInputSchema,
  clearanceHandoverActionInputSchema,
  clearanceHandoverDraftInputSchema,
  type ClearanceHandover,
  type ClearanceHandoverDetail,
} from '@/core/tenancy/transfers/validation';
import { Card } from '@/components/ui/data-display';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { Banner } from '@/components/ui/feedback';
import { useTenancyPresentation } from './presentation';
import {
  ClearanceAgreementUpload,
  TransferDocumentLink,
} from './transfer-files';

function responsibleParties(
  detail: TenancyMoveDetail,
  workspace: TenancyWorkspace,
) {
  const unit = detail.move.unit_id;
  const ids = new Set<string>([detail.tenant_membership_id]);
  for (const occupancy of workspace.occupancies) {
    if (
      occupancy.unit_id === unit &&
      !occupancy.is_tenant &&
      occupancy.status === 'active'
    ) {
      ids.add(occupancy.membership_id);
    }
  }
  return [...ids].map((membershipId) => ({
    id: membershipId,
    name:
      detail.tenant_membership_id === membershipId
        ? detail.tenant_name
        : (workspace.tenants.find((item) => item.id === membershipId)?.name ??
          'Active owner'),
    role:
      detail.tenant_membership_id === membershipId
        ? ('tenant' as const)
        : ('owner' as const),
  }));
}

export function MoveClearancePanel({
  detail,
  workspace,
  handovers,
  handoverDetails,
  canManage,
  issueAction = issueTenancyCertificateAction,
}: {
  detail: TenancyMoveDetail;
  workspace: TenancyWorkspace;
  handovers: ClearanceHandover[];
  handoverDetails: ClearanceHandoverDetail[];
  canManage: boolean;
  issueAction?: ModuleFormAction;
}) {
  const { t } = useTenancyPresentation();
  const id = useId();
  const parties = responsibleParties(detail, workspace);
  const [responsibleId, setResponsibleId] = useState(parties[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [designation, setDesignation] = useState('');
  const [purpose, setPurpose] = useState('Move-out clearance');
  if (detail.move.kind !== 'move_out') return null;
  const owed = detail.dues?.status === 'pending';
  const approved = handovers.some((handover) => handover.status === 'approved');
  const party = parties.find((item) => item.id === responsibleId);
  return (
    <Card title={t('Conditional handover and certificate')}>
      <Banner
        title={t('Dues remain with the unit')}
        tone={owed ? 'warning' : 'neutral'}
      >
        {t(
          'A handover records who agrees to pay. It never pays, waives or erases outstanding money.',
        )}
      </Banner>
      {handovers.map((handover) => (
        <div
          className="grid gap-space-3 rounded-md border border-rule p-space-3"
          key={handover.id}
        >
          <p className="text-body-strong">
            {t(handover.status)} · {t(handover.basis)} ·{' '}
            {t(handover.evidence_mode)}
          </p>
          <p className="text-caption text-ink-muted">
            {handover.approval_reference ?? t('Draft; not approved')}
          </p>
          {canManage && workspace.can_write && handover.status === 'draft' ? (
            <>
              {handover.evidence_mode !== 'admin_note'
                ? parties.map((item) => (
                    <ClearanceAgreementUpload
                      coveredMembershipId={item.id}
                      coveredTransferPartyId={null}
                      handover={handover}
                      key={item.id}
                    />
                  ))
                : null}
              <ModuleActionForm
                action={approveClearanceHandoverAction}
                confirmMessage={t(
                  'Approve this conditional handover? Current dues and all required evidence are rechecked; unit money remains unpaid.',
                )}
                submitLabel={t('Approve Handover')}
                input={() =>
                  clearanceHandoverActionInputSchema.parse({
                    handoverId: handover.id,
                    expectedVersion: handover.version,
                    approvalReference: `${detail.move.id.slice(0, 8)}-HANDOVER`,
                  })
                }
              >
                <p className="text-caption text-ink-muted">
                  {t(
                    'Approval rechecks current dues and every required agreement item.',
                  )}
                </p>
              </ModuleActionForm>
            </>
          ) : null}
          {!canManage && workspace.can_write && handover.status === 'draft' ? (
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
                {t('This records consent to this exact handover version.')}
              </p>
            </ModuleActionForm>
          ) : null}
          {handoverDetails
            .find((value) => value.handover.id === handover.id)
            ?.files.map((file) => (
              <TransferDocumentLink
                key={file.id}
                label={t('signed agreement')}
                path={file.path}
              />
            ))}
        </div>
      ))}
      {canManage && workspace.can_write && owed && !approved ? (
        <ModuleActionForm
          action={draftClearanceHandoverAction}
          idempotent
          submitDisabled={!party}
          submitLabel={t('Draft Conditional Handover')}
          input={(_, clientRequestId) =>
            clearanceHandoverDraftInputSchema.parse({
              moveId: detail.move.id,
              caseId: null,
              responsibleTransferPartyId: null,
              responsibleMembershipId: party?.id ?? null,
              responsibleRole: party?.role,
              adminNote: note || null,
              clientRequestId,
            })
          }
        >
          <SelectInput
            id={`${id}-party`}
            label={t('Party responsible for unpaid dues')}
            onChange={(event) => setResponsibleId(event.currentTarget.value)}
            options={parties.map((item) => ({
              value: item.id,
              label: `${item.name} (${item.role})`,
            }))}
            value={responsibleId}
          />
          <TextInput
            id={`${id}-note`}
            label={t('Agreement evidence note')}
            onChange={(event) => setNote(event.currentTarget.value)}
            value={note}
          />
        </ModuleActionForm>
      ) : null}
      {canManage &&
      workspace.can_write &&
      detail.move.status === 'completed' ? (
        <ModuleActionForm
          action={issueAction}
          confirmMessage={t(
            'Issue this numbered certificate after a fresh dues recheck and exact PDF verification?',
          )}
          idempotent
          submitDisabled={!designation}
          submitLabel={t('Issue Numbered Certificate')}
          input={(_, clientRequestId) =>
            certificatePrepareInputSchema.parse({
              moveId: detail.move.id,
              caseId: null,
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
              'The kind is derived on issue from a new dues check; the exact PDF is issued under a permanent society financial-year number.',
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
                'The full certificate records the purpose, tenant and owners, unit and authoritative dues result. It is not legal advice or proof of transfer of legal title.',
              )}
            </p>
          </Banner>
        </ModuleActionForm>
      ) : null}
    </Card>
  );
}
