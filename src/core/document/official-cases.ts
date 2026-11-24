// Enforce the admin-only D-86 official case boundary.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { getDocumentContext } from './operations';
import {
  officialCaseInputSchema,
  officialCaseLinkInputSchema,
  officialCaseRemindersInputSchema,
  officialCaseWorkspaceSchema,
} from './official-cases-validation';

export async function getOfficialCaseWorkspace() {
  const { context, societyId } = await getDocumentContext('document:list');
  return callModuleRpc(
    context,
    'document_official_case_workspace',
    { p_society_id: societyId },
    officialCaseWorkspaceSchema,
    'Could not load official cases. Refresh and retry.',
  );
}

export async function saveOfficialCase(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(officialCaseInputSchema, input);
  return callModuleRpc(
    context,
    'document_official_case_save',
    {
      p_society_id: societyId,
      p_id: value.id,
      p_authority: value.authority,
      p_reference: value.reference,
      p_subject: value.subject,
      p_relevant_period: value.relevantPeriod,
      p_received_on: value.receivedOn,
      p_filed_on: value.filedOn,
      p_filing_mode: value.filingMode,
      p_filing_acknowledgement: value.filingAcknowledgement,
      p_reply_due_on: value.replyDueOn,
      p_hearing_on: value.hearingOn,
      p_response_on: value.responseOn,
      p_status: value.status,
      p_reviewer_membership_id: value.reviewerMembershipId,
      p_compliance_entry_id: value.complianceEntryId,
      p_closed_on: value.closedOn,
      p_note: value.note,
      p_expected_version: value.expectedVersion,
      p_reason: value.reason,
      p_client_request_id: value.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The official case could not be saved. Check verified dates, reviewer and status.',
  );
}

export async function linkOfficialCaseEvidence(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(officialCaseLinkInputSchema, input);
  return callModuleRpc(
    context,
    'document_official_case_evidence_link',
    {
      p_society_id: societyId,
      p_case_id: value.caseId,
      p_version_id: value.versionId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Use a document in a folder created as administrators-only for case evidence.',
  );
}

export async function saveOfficialCaseReminders(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(officialCaseRemindersInputSchema, input);
  await callModuleRpc(
    context,
    'document_official_case_reminders_save',
    {
      p_society_id: societyId,
      p_enabled: value.enabled,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save official case reminders.',
  );
}
