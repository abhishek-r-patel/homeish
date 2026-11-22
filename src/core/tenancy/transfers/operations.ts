// Authorise transfer, handover and numbered-certificate RPC operations.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../../db/validated-rpc';
import { AppError, createRequestId } from '../../errors';
import { authorizeRequest } from '../../permissions/authorize';
import { hasPermission } from '../../permissions';
import { enforceRateLimit } from '../../rate-limit';
import { attestTenancyCertificatePrivileged } from '../../privileged';
import { buildRequestContext } from '../request-context';
import { storePreparedTenancyCertificate } from './files';
import {
  advanceTransferCaseInputSchema,
  certificateIssueInputSchema,
  certificatePrepareInputSchema,
  certificatePreparationSchema,
  certificateSupersedeInputSchema,
  certificatesPageSchema,
  clearanceAcknowledgementInputSchema,
  clearanceAcknowledgementSchema,
  clearanceConsentInputSchema,
  clearanceDuesSchema,
  clearanceFileInputSchema,
  clearanceHandoverActionInputSchema,
  clearanceHandoverDetailSchema,
  clearanceHandoverDraftInputSchema,
  clearanceHandoverPageSchema,
  clearanceTargetInputSchema,
  transferCaseDetailSchema,
  transferCaseInputSchema,
  transferCasesPageSchema,
  transferDecisionInputSchema,
  transferStageSchema,
} from './validation';

async function context(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const requestContext = await buildRequestContext(requestId);
  authorizeRequest(requestContext, {
    moduleKey: 'tenancy',
    permission,
    write,
  });
  if (!requestContext.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      requestContext.userId,
      requestContext.requestId,
    );
  }
  return requestContext;
}

async function readContext() {
  const requestContext = await buildRequestContext(createRequestId());
  authorizeRequest(requestContext, {
    moduleKey: 'tenancy',
    permission: 'tenancy:list',
  });
  if (!requestContext.societyId) throw new AppError('FORBIDDEN');
  return requestContext;
}

export async function acknowledgeClearanceWarning(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(clearanceAcknowledgementInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_acknowledge',
    {
      p_society_id: requestContext.societyId,
      p_warning_text: values.warningText,
      p_client_request_id: values.clientRequestId,
      p_request_id: requestContext.requestId,
    },
    z.iso.datetime({ offset: true }),
    'The clearance warning acknowledgement was not saved.',
  );
}

export async function getClearanceAcknowledgement() {
  const requestContext = await context('tenancy:manage');
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_acknowledgement_get',
    { p_society_id: requestContext.societyId },
    clearanceAcknowledgementSchema,
    'Could not load the clearance warning acknowledgement.',
  );
}

export async function saveTransferCase(input: unknown, requestId: string) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(transferCaseInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_transfer_case_save',
    {
      p_society_id: requestContext.societyId,
      p_case_id: values.caseId,
      p_unit_id: values.unitId,
      p_received_on: values.receivedOn,
      p_sellers: values.sellers.map(({ membershipId }) => ({
        membership_id: membershipId,
      })),
      p_buyer: {
        name: values.buyer.name,
        membership_id: values.buyer.membershipId,
        phone: values.buyer.phone,
        email: values.buyer.email,
      },
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: requestContext.requestId,
    },
    z.uuid(),
    'The transfer case was not saved. Check the unit, active sellers, buyer and received date.',
  );
}

export async function advanceTransferCase(input: unknown, requestId: string) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(advanceTransferCaseInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_transfer_case_advance',
    {
      p_society_id: requestContext.societyId,
      p_case_id: values.caseId,
      p_expected_version: values.expectedVersion,
      p_next_stage: values.nextStage,
      p_reason: values.reason,
      p_request_id: requestContext.requestId,
    },
    transferStageSchema,
    'The transfer stage was not saved. Refresh the case and check the required decision and dues.',
  );
}

export async function recordTransferDecision(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(transferDecisionInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_transfer_decision_record',
    {
      p_society_id: requestContext.societyId,
      p_case_id: values.caseId,
      p_decision: values.decision,
      p_resolution_reference: values.resolutionReference,
      p_resolution_date: values.resolutionDate,
      p_meeting_id: values.meetingId,
      p_conditions: values.conditions.map((condition) => ({
        ...condition,
        follow_up_on: condition.follow_up_on ?? null,
      })),
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: requestContext.requestId,
    },
    z.uuid(),
    'The committee decision was not saved. Check the resolution and conditions.',
  );
}

export async function listTransferCases(input: unknown = {}) {
  const requestContext = await readContext();
  const values = parseModuleInput(
    z
      .object({
        stage: transferStageSchema.nullable().default(null),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().nonnegative().default(0),
      })
      .strict(),
    input,
  );
  return callModuleRpc(
    requestContext,
    'tenancy_transfer_cases_page',
    {
      p_society_id: requestContext.societyId,
      p_stage: values.stage,
      p_limit: values.limit,
      p_offset: values.offset,
    },
    transferCasesPageSchema,
    'Could not load transfer cases. Refresh and retry.',
  );
}

export async function getTransferCase(caseId: unknown) {
  const requestContext = await readContext();
  const id = parseModuleInput(z.uuid(), caseId);
  return callModuleRpc(
    requestContext,
    'tenancy_transfer_case_get',
    { p_society_id: requestContext.societyId, p_case_id: id },
    transferCaseDetailSchema,
    'Could not load the transfer case. Refresh and retry.',
  );
}

export async function checkClearanceDues(input: unknown) {
  const requestContext = await context('tenancy:manage');
  const values = parseModuleInput(clearanceTargetInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_dues_check',
    {
      p_society_id: requestContext.societyId,
      p_move_id: values.moveId,
      p_case_id: values.caseId,
    },
    clearanceDuesSchema,
    'Could not recheck authoritative dues. Retry before making a decision.',
  );
}

export async function draftClearanceHandover(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(clearanceHandoverDraftInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_handover_draft',
    {
      p_society_id: requestContext.societyId,
      p_move_id: values.moveId,
      p_case_id: values.caseId,
      p_responsible_party_id: values.responsibleTransferPartyId,
      p_responsible_membership_id: values.responsibleMembershipId,
      p_responsible_role: values.responsibleRole,
      p_admin_note: values.adminNote,
      p_client_request_id: values.clientRequestId,
      p_request_id: requestContext.requestId,
    },
    z.uuid(),
    'The conditional handover was not drafted. Recheck dues and choose an eligible party.',
  );
}

export async function approveClearanceHandover(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(clearanceHandoverActionInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_handover_approve',
    {
      p_society_id: requestContext.societyId,
      p_handover_id: values.handoverId,
      p_expected_version: values.expectedVersion,
      p_approval_reference: values.approvalReference ?? null,
      p_request_id: requestContext.requestId,
    },
    z.null(),
    'The handover was not approved. Complete the configured evidence and recheck dues.',
  );
}

export async function consentClearanceHandover(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:consent', true, requestId);
  const values = parseModuleInput(clearanceConsentInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_handover_consent',
    {
      p_society_id: requestContext.societyId,
      p_handover_id: values.handoverId,
      p_expected_version: values.expectedVersion,
      p_request_id: requestContext.requestId,
    },
    z.uuid(),
    'Your handover consent was not recorded. Refresh the exact handover and retry.',
  );
}

export async function attachClearanceFile(input: unknown, requestId: string) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(clearanceFileInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_file_attach',
    {
      p_society_id: requestContext.societyId,
      p_handover_id: values.handoverId,
      p_covered_party_id: values.coveredTransferPartyId,
      p_covered_membership_id: values.coveredMembershipId,
      p_path: values.path,
      p_expected_version: values.expectedVersion,
      p_request_id: requestContext.requestId,
    },
    z.uuid(),
    'The agreement was not attached. Use the current draft handover and retry the private upload.',
  );
}

export async function listClearanceHandovers(input: unknown) {
  const requestContext = await readContext();
  const values = parseModuleInput(
    clearanceTargetInputSchema.extend({
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().nonnegative().default(0),
    }),
    input,
  );
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_handovers_page',
    {
      p_society_id: requestContext.societyId,
      p_move_id: values.moveId,
      p_case_id: values.caseId,
      p_limit: values.limit,
      p_offset: values.offset,
    },
    clearanceHandoverPageSchema,
    'Could not load clearance handovers. Refresh and retry.',
  );
}

export async function getClearanceHandover(handoverId: unknown) {
  const requestContext = await buildRequestContext(createRequestId());
  authorizeRequest(requestContext, {
    moduleKey: 'tenancy',
    permission: hasPermission(requestContext.roles, 'tenancy', 'tenancy:files')
      ? 'tenancy:files'
      : 'tenancy:consent',
  });
  const id = parseModuleInput(z.uuid(), handoverId);
  return callModuleRpc(
    requestContext,
    'tenancy_clearance_handover_get',
    {
      p_society_id: requestContext.societyId,
      p_handover_id: id,
    },
    clearanceHandoverDetailSchema,
    'Could not load the handover. Refresh and retry.',
  );
}

export async function listTenancyCertificates(input: unknown = {}) {
  const requestContext = await readContext();
  const values = parseModuleInput(
    z
      .object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().nonnegative().default(0),
      })
      .strict(),
    input,
  );
  return callModuleRpc(
    requestContext,
    'tenancy_certificates_page',
    {
      p_society_id: requestContext.societyId,
      p_limit: values.limit,
      p_offset: values.offset,
    },
    certificatesPageSchema,
    'Could not load tenancy certificates. Refresh and retry.',
  );
}

export async function issueTenancyCertificate(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:manage', true, requestId);
  if (!requestContext.societyId) throw new AppError('FORBIDDEN');
  const values = parseModuleInput(certificatePrepareInputSchema, input);
  const preparation = await callModuleRpc(
    requestContext,
    'tenancy_certificate_prepare',
    {
      p_society_id: requestContext.societyId,
      p_move_id: values.moveId,
      p_case_id: values.caseId,
      p_purpose: values.purpose,
      p_signatory_designation: values.signatoryDesignation,
      p_client_request_id: values.clientRequestId,
      p_request_id: requestContext.requestId,
    },
    certificatePreparationSchema,
    'The certificate was not prepared. Complete the target, recheck dues and confirm the signatory.',
  );
  if (preparation.status === 'issued') return preparation.certificate_id;
  const handover = preparation.handover_id
    ? await getClearanceHandover(preparation.handover_id)
    : null;
  const transfer =
    values.caseId && handover?.handover.responsible_transfer_party_id
      ? await getTransferCase(values.caseId)
      : null;
  const responsibleName =
    transfer?.parties.find(
      (party) => party.id === handover?.handover.responsible_transfer_party_id,
    )?.name ??
    preparation.parties.find(
      (party) =>
        party.membership_id === handover?.handover.responsible_membership_id,
    )?.name ??
    null;
  let approvingAdminName: string | null = null;
  if (handover?.handover.approved_by) {
    const { data, error } = await requestContext.db
      .from('profiles')
      .select('full_name')
      .eq('id', handover.handover.approved_by)
      .maybeSingle();
    if (error) {
      throw new Error(
        'Could not verify the handover approving administrator.',
        {
          cause: error,
        },
      );
    }
    approvingAdminName = data?.full_name ?? null;
  }
  const expectedBytes = await storePreparedTenancyCertificate(
    requestContext,
    preparation,
    handover,
    responsibleName,
    approvingAdminName,
  );
  await attestTenancyCertificatePrivileged({
    societyId: requestContext.societyId,
    moveId: values.moveId,
    caseId: values.caseId,
    issuerId: requestContext.userId,
    path: preparation.path,
    expectedBytes,
    requestId: requestContext.requestId,
  });
  return callModuleRpc(
    requestContext,
    'tenancy_certificate_issue',
    {
      p_society_id: requestContext.societyId,
      p_move_id: values.moveId,
      p_case_id: values.caseId,
      p_expected_version: preparation.expected_version,
      p_request_id: requestContext.requestId,
    },
    z.uuid(),
    'The certificate was not issued. Dues or the verified artifact changed; prepare again.',
  );
}

export async function supersedeTenancyCertificate(
  input: unknown,
  requestId: string,
) {
  const requestContext = await context('tenancy:manage', true, requestId);
  const values = parseModuleInput(certificateSupersedeInputSchema, input);
  return callModuleRpc(
    requestContext,
    'tenancy_certificate_supersede',
    {
      p_society_id: requestContext.societyId,
      p_certificate_id: values.certificateId,
      p_replacement_certificate_id: values.replacementCertificateId,
      p_reason: values.reason,
      p_request_id: requestContext.requestId,
    },
    z.null(),
    'The certificate was not superseded. Refresh and choose a replacement for the same target.',
  );
}

export const certificateIssueActionSchema = certificateIssueInputSchema;
