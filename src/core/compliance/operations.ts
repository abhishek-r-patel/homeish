// Enforce factual compliance and shared data-cleanup operations at the Core boundary.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import {
  complianceEntryInputSchema,
  complianceRemindersInputSchema,
  complianceWorkspaceSchema,
  dataCleanupRuleInputSchema,
  dataCleanupRulesSchema,
} from './validation';

async function complianceContext(
  permission: 'compliance:read' | 'compliance:manage',
  write = false,
  requestId?: string,
) {
  const context = await buildRequestContext(requestId ?? createRequestId());
  authorizeRequest(context, { moduleKey: 'core', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getComplianceWorkspace() {
  const { context, societyId } = await complianceContext('compliance:read');
  return callModuleRpc(
    context,
    'compliance_workspace',
    { p_society_id: societyId },
    complianceWorkspaceSchema,
    'Could not load the compliance register. Refresh and retry.',
  );
}

export async function acknowledgeCompliance(requestId: string) {
  const { context, societyId } = await complianceContext(
    'compliance:manage',
    true,
    requestId,
  );
  return callModuleRpc(
    context,
    'compliance_acknowledge',
    { p_society_id: societyId, p_request_id: context.requestId },
    z.iso.datetime({ offset: true }),
    'Could not record the compliance acknowledgement.',
  );
}

export async function saveComplianceEntry(input: unknown, requestId: string) {
  const { context, societyId } = await complianceContext(
    'compliance:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(complianceEntryInputSchema, input);
  return callModuleRpc(
    context,
    'compliance_entry_save',
    {
      p_society_id: societyId,
      p_id: value.id,
      p_title: value.title,
      p_authority: value.authority,
      p_recurrence: value.recurrence,
      p_due_date: value.dueDate,
      p_responsible_membership_id: value.responsibleMembershipId,
      p_status: value.status,
      p_completed_on: value.completedOn,
      p_evidence_version_id: value.evidenceVersionId,
      p_note: value.note,
      p_expected_version: value.expectedVersion,
      p_reason: value.reason,
      p_client_request_id: value.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The compliance record could not be saved. Check its verified dates, source and evidence.',
  );
}

export async function saveComplianceReminders(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await complianceContext(
    'compliance:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(complianceRemindersInputSchema, input);
  await callModuleRpc(
    context,
    'compliance_reminders_save',
    {
      p_society_id: societyId,
      p_enabled: value.enabled,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save the compliance reminder setting.',
  );
}

export async function getDataCleanupRules() {
  const { context, societyId } = await complianceContext('compliance:read');
  return callModuleRpc(
    context,
    'data_cleanup_rules_get',
    { p_society_id: societyId },
    dataCleanupRulesSchema,
    'Could not load data cleanup rules.',
  );
}

export async function saveDataCleanupRule(input: unknown, requestId: string) {
  const { context, societyId } = await complianceContext(
    'compliance:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(dataCleanupRuleInputSchema, input);
  return callModuleRpc(
    context,
    'data_cleanup_rule_save',
    {
      p_society_id: societyId,
      p_record_kind: value.recordKind,
      p_enabled: value.enabled,
      p_older_than_years: value.olderThanYears,
      p_expected_version: value.expectedVersion,
      p_request_id: context.requestId,
    },
    dataCleanupRulesSchema.element,
    'The cleanup rule could not be saved. Refresh and retry.',
  );
}
