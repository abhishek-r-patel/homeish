// Authorise Document Repository reads and admin writes through audited database RPCs.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  documentArchiveInputSchema,
  documentCreateInputSchema,
  documentDetailSchema,
  documentFolderArchiveInputSchema,
  documentFolderInputSchema,
  documentFolderSchema,
  documentGovernanceArchiveInputSchema,
  documentGovernanceHistorySchema,
  documentGovernanceHistoryInputSchema,
  documentGovernanceListInputSchema,
  documentGovernanceListSchema,
  documentGovernanceRecordSchema,
  documentGovernanceSaveInputSchema,
  documentGovernanceSourceListInputSchema,
  documentGovernanceSourceListSchema,
  documentListInputSchema,
  documentListSchema,
  documentPublishedHouseRulesSchema,
  documentHouseRulePublishInputSchema,
  documentSettingsInputSchema,
  documentSchema,
  documentUpdateInputSchema,
  documentVersionArchiveInputSchema,
  documentVersionInputSchema,
  documentWorkspaceSchema,
} from './validation';

export async function getDocumentContext(
  permission: 'document:list' | 'document:manage',
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'document', permission, write });
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

export async function getDocumentWorkspace() {
  const { context, societyId } = await getDocumentContext('document:list');
  return callModuleRpc(
    context,
    'document_workspace_get',
    { p_society_id: societyId },
    documentWorkspaceSchema,
    'Could not load society documents. Refresh and retry.',
  );
}

export async function listDocuments(input: unknown) {
  const { context, societyId } = await getDocumentContext('document:list');
  const page = parseModuleInput(documentListInputSchema, input);
  return callModuleRpc(
    context,
    'document_list',
    {
      p_society_id: societyId,
      p_folder_id: page.folderId,
      p_unit_id: page.unitId,
      p_include_archived: page.includeArchived,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    documentListSchema,
    'Could not load these documents. Refresh and retry.',
  );
}

export async function getDocument(documentId: unknown) {
  const { context, societyId } = await getDocumentContext('document:list');
  const id = parseModuleInput(z.uuid(), documentId);
  return callModuleRpc(
    context,
    'document_get',
    { p_society_id: societyId, p_document_id: id },
    documentDetailSchema,
    'Could not load this document. Refresh and retry.',
  );
}

export async function saveDocumentFolder(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const folder = parseModuleInput(documentFolderInputSchema, input);
  return callModuleRpc(
    context,
    'document_folder_save',
    {
      p_society_id: societyId,
      p_folder_id: folder.folderId,
      p_name: folder.name,
      p_audience: folder.audience,
      p_expected_version: folder.expectedVersion,
      p_request_id: context.requestId,
    },
    documentFolderSchema,
    'Could not save the folder. Use a unique name and keep at most 50 active folders.',
  );
}

export async function setDocumentFolderArchived(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const change = parseModuleInput(documentFolderArchiveInputSchema, input);
  return callModuleRpc(
    context,
    'document_folder_set_archived',
    {
      p_society_id: societyId,
      p_folder_id: change.folderId,
      p_archived: change.archived,
      p_expected_version: change.expectedVersion,
      p_request_id: context.requestId,
    },
    documentFolderSchema,
    'Could not change the folder. A restored folder needs a unique name.',
  );
}

export async function createDocument(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const document = parseModuleInput(documentCreateInputSchema, input);
  return callModuleRpc(
    context,
    'document_create',
    {
      p_society_id: societyId,
      p_folder_id: document.folderId,
      p_unit_id: document.unitId,
      p_unit_audience: document.unitAudience,
      p_title: document.title,
      p_description: document.description,
      p_path: document.path,
      p_file_name: document.fileName,
      p_client_request_id: document.clientRequestId,
      p_request_id: context.requestId,
    },
    documentSchema,
    'Could not publish the document. Upload the file again and choose an active folder or unit.',
  );
}

export async function addDocumentVersion(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const version = parseModuleInput(documentVersionInputSchema, input);
  return callModuleRpc(
    context,
    'document_version_add',
    {
      p_society_id: societyId,
      p_document_id: version.documentId,
      p_path: version.path,
      p_file_name: version.fileName,
      p_note: version.note,
      p_expected_version: version.expectedVersion,
      p_request_id: context.requestId,
    },
    documentSchema,
    'Could not add the new version. Upload the file again and retry.',
  );
}

export async function updateDocument(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const document = parseModuleInput(documentUpdateInputSchema, input);
  return callModuleRpc(
    context,
    'document_update',
    {
      p_society_id: societyId,
      p_document_id: document.documentId,
      p_title: document.title,
      p_description: document.description,
      p_unit_audience: document.unitAudience,
      p_expected_version: document.expectedVersion,
      p_request_id: context.requestId,
    },
    documentSchema,
    'Could not save the document details. Check them and retry.',
  );
}

export async function setDocumentArchived(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const change = parseModuleInput(documentArchiveInputSchema, input);
  return callModuleRpc(
    context,
    'document_set_archived',
    {
      p_society_id: societyId,
      p_document_id: change.documentId,
      p_archived: change.archived,
      p_expected_version: change.expectedVersion,
      p_request_id: context.requestId,
    },
    documentSchema,
    'Could not change the document. Refresh and retry.',
  );
}

export async function setDocumentVersionArchived(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const change = parseModuleInput(documentVersionArchiveInputSchema, input);
  return callModuleRpc(
    context,
    'document_version_set_archived',
    {
      p_society_id: societyId,
      p_version_id: change.versionId,
      p_archived: change.archived,
      p_expected_version: change.expectedVersion,
      p_request_id: context.requestId,
    },
    documentSchema,
    'Could not change the version. A document must keep at least one active version.',
  );
}

export async function listGovernanceSources(input: unknown) {
  const { context, societyId } = await getDocumentContext('document:manage');
  const page = parseModuleInput(documentGovernanceSourceListInputSchema, input);
  return callModuleRpc(
    context,
    'document_governance_sources_list',
    {
      p_society_id: societyId,
      p_kind: page.kind,
      p_source_type: page.sourceKind,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    documentGovernanceSourceListSchema,
    'Could not load evidence sources. Refresh and retry.',
  );
}

export async function listGovernanceRecords(input: unknown) {
  const { context, societyId } = await getDocumentContext('document:list');
  const page = parseModuleInput(documentGovernanceListInputSchema, input);
  return callModuleRpc(
    context,
    'document_governance_list',
    {
      p_society_id: societyId,
      p_kind: page.kind,
      p_include_archived: page.includeArchived,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    documentGovernanceListSchema,
    'Could not load governance records. Refresh and retry.',
  );
}

export async function getGovernanceRecord(recordId: unknown) {
  const { context, societyId } = await getDocumentContext('document:list');
  return callModuleRpc(
    context,
    'document_governance_get',
    {
      p_society_id: societyId,
      p_record_id: parseModuleInput(z.uuid(), recordId),
    },
    documentGovernanceRecordSchema,
    'Could not load this governance record. Refresh and retry.',
  );
}

export async function saveGovernanceRecord(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const record = parseModuleInput(documentGovernanceSaveInputSchema, input);
  const sourceKind = record.source?.kind ?? null;
  return callModuleRpc(
    context,
    'document_governance_save',
    {
      p_society_id: societyId,
      p_record_id: record.recordId,
      p_kind: record.kind,
      p_title: record.title,
      p_state: record.state,
      p_document_version_id:
        sourceKind === 'document_version' ? record.source?.id : null,
      p_tenancy_document_id:
        sourceKind === 'tenancy_noc' ? record.source?.id : null,
      p_resolution_id:
        sourceKind === 'meeting_resolution' ? record.source?.id : null,
      p_approving_resolution_id: record.approvingResolutionId,
      p_details: record.details,
      p_expected_version: record.expectedVersion,
      p_reason: record.reason,
      p_client_request_id: record.clientRequestId,
      p_request_id: context.requestId,
    },
    documentGovernanceRecordSchema,
    record.recordId
      ? 'Could not save this record. Check the source, reason and current version, then retry.'
      : 'Could not create this record. Check the evidence and retry.',
  );
}

export async function setGovernanceRecordArchived(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const change = parseModuleInput(documentGovernanceArchiveInputSchema, input);
  return callModuleRpc(
    context,
    'document_governance_set_archived',
    {
      p_society_id: societyId,
      p_record_id: change.recordId,
      p_archived: change.archived,
      p_expected_version: change.expectedVersion,
      p_reason: change.reason,
      p_request_id: context.requestId,
    },
    documentGovernanceRecordSchema,
    'Could not change this record. Check the reason and refresh the latest version.',
  );
}

export async function listGovernanceHistory(input: unknown) {
  const { context, societyId } = await getDocumentContext('document:manage');
  const page = parseModuleInput(documentGovernanceHistoryInputSchema, input);
  return callModuleRpc(
    context,
    'document_governance_history',
    {
      p_society_id: societyId,
      p_record_id: page.recordId,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    documentGovernanceHistorySchema,
    'Could not load private history. Refresh and retry.',
  );
}

export async function publishHouseRule(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const record = parseModuleInput(documentHouseRulePublishInputSchema, input);
  return callModuleRpc(
    context,
    'document_house_rule_publish',
    {
      p_society_id: societyId,
      p_record_id: record.recordId,
      p_expected_version: record.expectedVersion,
      p_request_id: context.requestId,
    },
    documentGovernanceRecordSchema,
    'Publishing is locked pending qualified review and a separately approved unlock.',
  );
}

export async function listPublishedHouseRules() {
  const { context, societyId } = await getDocumentContext('document:list');
  return callModuleRpc(
    context,
    'document_house_rules_published_list',
    { p_society_id: societyId },
    documentPublishedHouseRulesSchema,
    'Could not load published house rules. Refresh and retry.',
  );
}

export async function updateDocumentReminderSettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const settings = parseModuleInput(documentSettingsInputSchema, input);
  return callModuleRpc(
    context,
    'document_settings_update',
    {
      p_society_id: societyId,
      p_expiry_reminders_enabled: settings.expiryRemindersEnabled,
      p_request_id: context.requestId,
    },
    z.object({ expiry_reminders_enabled: z.boolean() }).strict(),
    'Could not save the reminder setting. Nothing was changed; retry.',
  );
}
