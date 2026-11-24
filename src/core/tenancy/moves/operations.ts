// Authorise optional move operations and validate transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../../db/validated-rpc';
import { AppError, createRequestId } from '../../errors';
import { authorizeRequest } from '../../permissions/authorize';
import { hasPermission } from '../../permissions';
import { enforceRateLimit } from '../../rate-limit';
import { attestTenancyNocPrivileged } from '../../privileged';
import { buildRequestContext } from '../request-context';
import { storePreparedTenancyNoc } from './files';
import { canAdminEditAllModuleSettings } from '../../modules/setting-access';
import {
  tenancyAgreementMetadataInputSchema,
  tenancyDecisionInputSchema,
  tenancyDocumentInputSchema,
  tenancyMoveDetailSchema,
  tenancyMoveInputSchema,
  tenancyMoveProgressSchema,
  tenancyNocPreparationSchema,
  tenancyPageInputSchema,
  tenancyPageSchema,
  tenancySettingsInputSchema,
  tenancyVerificationInputSchema,
  tenancyVersionInputSchema,
  tenancyCompleteInputSchema,
  tenancyWorkspaceSchema,
} from './validation';

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'tenancy', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

async function getReadContext() {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'tenancy',
    permission: hasPermission(context.roles, 'tenancy', 'tenancy:list')
      ? 'tenancy:list'
      : 'tenancy:guard',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getTenancyWorkspace(includeTargets = true) {
  const { context, societyId } = await getReadContext();
  const include = parseModuleInput(z.boolean(), includeTargets);
  const [workspace, canEditSettings] = await Promise.all([
    callModuleRpc(
      context,
      'tenancy_workspace_get',
      { p_society_id: societyId, p_include_targets: include },
      tenancyWorkspaceSchema,
      'Could not load moving access and eligible tenants. Refresh and retry.',
    ),
    canAdminEditAllModuleSettings('tenancy', context),
  ]);
  return { ...workspace, can_edit_settings: canEditSettings };
}

export async function listTenancyMoves(input: unknown = {}) {
  const { context, societyId } = await getReadContext();
  const page = parseModuleInput(tenancyPageInputSchema, input);
  return callModuleRpc(
    context,
    'tenancy_moves_page',
    {
      p_society_id: societyId,
      p_status: page.status,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    tenancyPageSchema,
    'Could not load the moving schedule. Retry to see current requests.',
  );
}

export async function getTenancyMove(moveId: unknown) {
  const { context, societyId } = await getContext('tenancy:files');
  const id = parseModuleInput(z.uuid(), moveId);
  return callModuleRpc(
    context,
    'tenancy_move_get',
    { p_society_id: societyId, p_move_id: id },
    tenancyMoveDetailSchema,
    'Could not load the move request. Refresh and retry.',
  );
}

export async function getTenancyMoveProgress(moveId: unknown) {
  const { context, societyId } = await getContext('tenancy:files');
  const id = parseModuleInput(z.uuid(), moveId);
  return callModuleRpc(
    context,
    'tenancy_move_progress_get',
    { p_society_id: societyId, p_move_id: id },
    tenancyMoveProgressSchema,
    'Could not load move progress. Refresh and retry.',
  );
}

export async function createTenancyMove(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'tenancy:create',
    true,
    requestId,
  );
  const move = parseModuleInput(tenancyMoveInputSchema, input);
  return callModuleRpc(
    context,
    'tenancy_move_create',
    {
      p_society_id: societyId,
      p_unit_id: move.unitId,
      p_tenant_membership_id: move.tenantMembershipId,
      p_kind: move.kind,
      p_starts_at: move.startsAt,
      p_ends_at: move.endsAt,
      p_agreement_expires_on: move.agreementExpiresOn,
      p_amenity_booking_id: move.amenityBookingId,
      p_client_request_id: move.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Could not create the move request. Choose an invited tenant, a future window and a valid agreement expiry.',
  );
}

export async function consentTenancyMove(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'tenancy:consent',
    true,
    requestId,
  );
  const move = parseModuleInput(tenancyCompleteInputSchema, input);
  await callModuleRpc(
    context,
    'tenancy_move_consent',
    {
      p_society_id: societyId,
      p_move_id: move.moveId,
      p_expected_version: move.expectedVersion,
      p_request_id: context.requestId,
      p_override_open_handover: move.overrideOpenHandover,
    },
    z.null(),
    'Could not record owner consent. Check the required proofs and current move status, then retry.',
  );
}

export async function decideTenancyMove(input: unknown, requestId: string) {
  const values = parseModuleInput(tenancyDecisionInputSchema, input);
  const { context, societyId } = await getContext(
    values.decision === 'cancelled' ? 'tenancy:create' : 'tenancy:manage',
    true,
    requestId,
  );
  await callModuleRpc(
    context,
    'tenancy_move_decide',
    {
      p_society_id: societyId,
      p_move_id: values.moveId,
      p_decision: values.decision,
      p_expected_version: values.expectedVersion,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save this decision. Check owner consent, required proofs and the current move status.',
  );
}

export async function completeTenancyMove(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'tenancy:manage',
    true,
    requestId,
  );
  const move = parseModuleInput(tenancyVersionInputSchema, input);
  return callModuleRpc(
    context,
    'tenancy_move_complete',
    {
      p_society_id: societyId,
      p_move_id: move.moveId,
      p_expected_version: move.expectedVersion,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Move completion was not saved. Check the schedule, tenant invitation, owner consent, required proofs and any outstanding unit dues, then retry.',
  );
}

export async function attachTenancyDocument(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'tenancy:files',
    true,
    requestId,
  );
  const document = parseModuleInput(tenancyDocumentInputSchema, input);
  return callModuleRpc(
    context,
    'tenancy_document_attach',
    {
      p_society_id: societyId,
      p_move_id: document.moveId,
      p_kind: document.kind,
      p_path: document.path,
      p_expected_version: document.expectedVersion,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The proof was not attached. Use a PDF, JPG or PNG up to 5 MiB and refresh the move before retrying.',
  );
}

export async function saveTenancySettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'tenancy:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(tenancySettingsInputSchema, input);
  await callModuleRpc(
    context,
    'tenancy_settings_update',
    {
      p_society_id: societyId,
      p_police_verification_required: values.policeVerificationRequired,
      p_clearance_handover_basis: values.clearanceHandoverBasis,
      p_clearance_agreement_evidence: values.clearanceAgreementEvidence,
      p_verification_tracking_enabled: values.verificationTrackingEnabled,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not update the Tenancy settings.',
  );
}

export async function saveTenancyVerification(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'tenancy:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(tenancyVerificationInputSchema, input);
  await callModuleRpc(
    context,
    'tenancy_verification_save',
    {
      p_society_id: societyId,
      p_move_id: values.moveId,
      p_expected_version: values.expectedVersion,
      p_verification_status: values.status,
      p_verification_checked_on: values.recordedOn,
      p_verification_reference: values.reference,
      p_request_id: context.requestId,
    },
    z.null(),
    'The verification record was not saved. Refresh and retry.',
  );
}

export async function saveTenancyAgreementMetadata(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'tenancy:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(tenancyAgreementMetadataInputSchema, input);
  await callModuleRpc(
    context,
    'tenancy_agreement_metadata_save',
    {
      p_society_id: societyId,
      p_move_id: values.moveId,
      p_expected_version: values.expectedVersion,
      p_agreement_type: values.agreementType,
      p_agreement_starts_on: values.startsOn,
      p_agreement_expires_on: values.expiresOn,
      p_request_id: context.requestId,
    },
    z.null(),
    'The agreement metadata was not saved. Refresh and retry.',
  );
}

export async function issueTenancyNoc(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'tenancy:manage',
    true,
    requestId,
  );
  const move = parseModuleInput(tenancyVersionInputSchema, input);
  const preparation = await callModuleRpc(
    context,
    'tenancy_noc_prepare',
    {
      p_society_id: societyId,
      p_move_id: move.moveId,
      p_expected_version: move.expectedVersion,
      p_request_id: context.requestId,
    },
    tenancyNocPreparationSchema,
    'The NOC was not issued. Complete move-out and clear any outstanding unit dues, then refresh and retry within the one-year retention period.',
  );
  if (preparation.status === 'issued') return preparation.document_id;
  const expectedBytes = await storePreparedTenancyNoc(context, preparation);
  await attestTenancyNocPrivileged({
    societyId,
    moveId: move.moveId,
    issuerId: context.userId,
    path: preparation.path,
    expectedVersion: preparation.expected_version,
    expectedBytes,
    requestId: context.requestId,
  });
  return callModuleRpc(
    context,
    'tenancy_noc_issue',
    {
      p_society_id: societyId,
      p_move_id: move.moveId,
      p_path: preparation.path,
      p_expected_version: preparation.expected_version,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The NOC was not issued. Check current unit dues and Billing availability, then refresh and retry.',
  );
}
