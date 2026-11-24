// Authorize and validate P50 repair project, budget and spend operations.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { buildRequestContext } from '../tenancy/request-context';
import { canAdminEditAllModuleSettings } from '../modules/setting-access';
import { FILE_CONTENT_TYPES, verifyFileAttachment } from '../files/attachments';
import {
  majorWorksAdminListSchema,
  majorWorksAuditInputSchema,
  majorWorksAuditsSchema,
  majorWorksAuditVoidInputSchema,
  majorWorksBudgetInputSchema,
  majorWorksProjectInputSchema,
  majorWorksProjectStatusInputSchema,
  majorWorksChosenQuoteInputSchema,
  majorWorksCriteriaInputSchema,
  majorWorksQuoteInputSchema,
  majorWorksQuoteRemoveInputSchema,
  majorWorksScoringSchema,
  majorWorksScoringTransitionInputSchema,
  majorWorksScoresInputSchema,
  majorWorksScenarioInputSchema,
  majorWorksScenariosSchema,
  majorWorksProposalFileInputSchema,
  majorWorksProposalInputSchema,
  majorWorksProposalsSchema,
  majorWorksProposalStageInputSchema,
  majorWorksConsentMethodInputSchema,
  majorWorksConsentPollInputSchema,
  majorWorksConsentRecordInputSchema,
  majorWorksConsentViewSchema,
  majorWorksMilestoneInputSchema,
  majorWorksMilestonesSchema,
  majorWorksMyConsentsSchema,
  majorWorksProposalArchiveInputSchema,
  majorWorksSummarySchema,
  majorWorksResidentListSchema,
  majorWorksSpendTagInputSchema,
  majorWorksSpendTagRemoveInputSchema,
} from './validation';

type Access = 'admin_read' | 'resident_read' | 'manage';
const PERMISSIONS: Record<Access, string> = {
  admin_read: 'major_works:list',
  resident_read: 'major_works:resident_read',
  manage: 'major_works:manage',
};

async function contextFor(access: Access, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'major_works',
    permission: PERMISSIONS[access],
    write: access === 'manage',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function listMajorWorksProjects() {
  const { context, societyId } = await contextFor('admin_read');
  return callModuleRpc(
    context,
    'major_works_projects_list',
    { p_society_id: societyId },
    majorWorksAdminListSchema,
    'Could not load repair projects.',
  );
}

export async function listResidentMajorWorksProjects() {
  const { context, societyId } = await contextFor('resident_read');
  return callModuleRpc(
    context,
    'major_works_resident_projects_get',
    { p_society_id: societyId },
    majorWorksResidentListSchema,
    'Could not load repair projects.',
  );
}

export async function saveMajorWorksProject(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksProjectInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_project_save',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_title: value.title,
      p_location: value.location,
      p_category: value.category,
      p_priority: value.priority,
      p_estimate_paise: value.estimateRupees,
      p_planned_start_on: value.plannedStartOn,
      p_planned_end_on: value.plannedEndOn,
      p_actual_start_on: value.actualStartOn,
      p_actual_end_on: value.actualEndOn,
      p_progress_percent: value.progressPercent,
      p_notes: value.notes,
      p_forecast_item_id: value.forecastItemId,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the project name, dates, estimate, priority and progress.',
  );
}

export async function setMajorWorksProjectStatus(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksProjectStatusInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_project_status_set',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_status: value.status,
      p_reason: value.reason,
      p_approval_body: value.approvalBody,
      p_approval_date: value.approvalDate,
      p_meeting_resolution_id: value.meetingResolutionId,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the allowed status, reason and recorded approval.',
  );
}

export async function setMajorWorksProjectBudget(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksBudgetInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_project_budget_set',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_source: value.source,
      p_typed_budget_paise: value.typedBudgetRupees,
      p_fund_work_id: value.fundWorkId,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a valid typed or sanctioned-work budget.',
  );
}

export async function addMajorWorksSpendTag(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksSpendTagInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_spend_tag_save',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_entry_id: value.entryId,
      p_amount_paise: value.amountRupees,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a posted Accounts expense and an available tag amount.',
  );
}

export async function removeMajorWorksSpendTag(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksSpendTagRemoveInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_spend_tag_remove',
    {
      p_society_id: societyId,
      p_tag_id: value.tagId,
      p_reason: value.reason,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason and refresh if the spend tag changed.',
  );
}

export async function listMajorWorksAudits() {
  const { context, societyId } = await contextFor('admin_read');
  const result = await callModuleRpc(
    context,
    'major_works_audits_list',
    { p_society_id: societyId },
    majorWorksAuditsSchema,
    'Could not load structural audits.',
  );
  return {
    ...result,
    audits: await Promise.all(
      result.audits.map(async (audit) => {
        if (!audit.report_path) return { ...audit, report_url: null };
        const { data, error } = await context.db.storage
          .from('major-works-files')
          .createSignedUrl(audit.report_path, 300);
        if (error || !data) {
          throw new Error('Could not open the private structural audit.', {
            cause: error,
          });
        }
        return { ...audit, report_url: data.signedUrl };
      }),
    ),
  };
}

export async function saveMajorWorksAudit(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksAuditInputSchema, input);
  if (value.reportPath) {
    if (!context.userId) throw new AppError('FORBIDDEN');
    await verifyFileAttachment(context, {
      bucket: 'major-works-files',
      contentTypes: FILE_CONTENT_TYPES,
      maxBytes: 10 * 1024 * 1024,
      ownerPath: `${societyId}/${context.userId}/audits`,
      path: value.reportPath,
      societyId,
    });
  }
  return callModuleRpc(
    context,
    'major_works_audit_save',
    {
      p_society_id: societyId,
      p_audit_id: value.auditId,
      p_audit_on: value.auditOn,
      p_auditor_name: value.auditorName,
      p_findings: value.findings,
      p_rating: value.rating,
      p_report_path: value.reportPath,
      p_repair_status: value.repairStatus,
      p_next_due_on: value.nextDueOn,
      p_project_ids: value.projectIds,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the audit date, findings, rating, report, repair status and due date.',
  );
}

export async function voidMajorWorksAudit(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksAuditVoidInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_audit_void',
    {
      p_society_id: societyId,
      p_audit_id: value.auditId,
      p_reason: value.reason,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason for voiding this structural audit.',
  );
}

export async function getMajorWorksScoring(projectId: string) {
  const { context, societyId } = await contextFor('admin_read');
  const validProjectId = z.uuid().parse(projectId);
  const result = await callModuleRpc(
    context,
    'major_works_scoring_get',
    { p_society_id: societyId, p_project_id: validProjectId },
    majorWorksScoringSchema,
    'Could not load quote scoring.',
  );
  return {
    ...result,
    quotes: await Promise.all(
      result.quotes.map(async (quote) => {
        if (!quote.file_path) return { ...quote, file_url: null };
        const { data, error } = await context.db.storage
          .from('major-works-files')
          .createSignedUrl(quote.file_path, 300);
        if (error || !data) {
          throw new Error('Could not open the private quote file.', {
            cause: error,
          });
        }
        return { ...quote, file_url: data.signedUrl };
      }),
    ),
  };
}

export async function addMajorWorksQuote(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksQuoteInputSchema, input);
  if (value.filePath) {
    if (!context.userId) throw new AppError('FORBIDDEN');
    await verifyFileAttachment(context, {
      bucket: 'major-works-files',
      contentTypes: FILE_CONTENT_TYPES,
      maxBytes: 10 * 1024 * 1024,
      ownerPath: `${societyId}/${context.userId}/quotes`,
      path: value.filePath,
      societyId,
    });
  }
  return callModuleRpc(
    context,
    'major_works_quote_add',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_vendor_quote_id: value.vendorQuoteId,
      p_vendor_name: value.vendorName,
      p_amount_paise: value.amountRupees,
      p_scope_note: value.scopeNote,
      p_file_path: value.filePath,
      p_like_for_like: value.likeForLike,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the quote, scope, amount and file.',
  );
}

export async function removeMajorWorksQuote(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksQuoteRemoveInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_quote_remove',
    {
      p_society_id: societyId,
      p_quote_id: value.quoteId,
      p_reason: value.reason,
      p_exclude: value.exclude,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason for excluding or removing the quote.',
  );
}

export async function saveMajorWorksCriteria(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksCriteriaInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_criteria_set',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_items: value.criteria,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Use 2 to 8 criteria with weights totalling 100.',
  );
}

export async function transitionMajorWorksScoring(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksScoringTransitionInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_scoring_transition',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_action: value.action,
      p_reason: value.reason,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the scoring state, criteria, quotes and reason.',
  );
}

export async function saveMajorWorksScores(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('admin_read', requestId);
  const value = parseModuleInput(majorWorksScoresInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_scores_save',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_items: value.items.map((item) => ({
        quote_id: item.quoteId,
        criterion_id: item.criterionId,
        score: item.score,
      })),
      p_request_trace: requestId,
    },
    z.number().int().nonnegative(),
    'Score every supplied quote and criterion from 0 to 10.',
  );
}

export async function chooseMajorWorksQuote(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksChosenQuoteInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_chosen_quote_set',
    {
      p_society_id: societyId,
      p_project_id: value.projectId,
      p_quote_id: value.quoteId,
      p_reason: value.reason,
      p_resolution_id: value.resolutionId,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a live quote and record the society decision reason.',
  );
}

export async function listMajorWorksScenarios(projectId: string) {
  const { context, societyId } = await contextFor('admin_read');
  return callModuleRpc(
    context,
    'major_works_scenarios_list',
    {
      p_society_id: societyId,
      p_project_id: z.uuid().parse(projectId),
    },
    majorWorksScenariosSchema,
    'Could not load funding scenarios.',
  );
}

export async function saveMajorWorksScenario(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksScenarioInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_scenario_save',
    {
      p_society_id: societyId,
      p_scenario_id: value.scenarioId,
      p_project_id: value.projectId,
      p_name: value.name,
      p_amount_basis: value.amountBasis,
      p_typed_amount_paise: value.typedAmountPaise,
      p_deduction_type: value.deductionType,
      p_deduction_paise: value.deductionPaise,
      p_fund_id: value.fundId,
      p_split: value.split,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the what-if amount, deduction source and unit split.',
  );
}

export async function listMajorWorksProposals() {
  const { context, societyId } = await contextFor('admin_read');
  const result = await callModuleRpc(
    context,
    'major_works_proposals_list',
    { p_society_id: societyId },
    majorWorksProposalsSchema,
    'Could not load redevelopment proposals.',
  );
  return {
    ...result,
    proposals: await Promise.all(
      result.proposals.map(async (proposal) => ({
        ...proposal,
        files: await Promise.all(
          proposal.files.map(async (file) => {
            const { data, error } = await context.db.storage
              .from('major-works-files')
              .createSignedUrl(file.path, 300);
            if (error || !data) {
              throw new Error('Could not open the private proposal file.', {
                cause: error,
              });
            }
            return { ...file, url: data.signedUrl };
          }),
        ),
      })),
    ),
  };
}

export async function saveMajorWorksProposal(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksProposalInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_proposal_save',
    {
      p_society_id: societyId,
      p_proposal_id: value.proposalId,
      p_developer_name: value.developerName,
      p_received_on: value.receivedOn,
      p_decision_due_on: value.decisionDueOn,
      p_extra_area_bp: value.extraAreaBp,
      p_monthly_rent_paise: value.monthlyRentPaise,
      p_corpus_paise: value.corpusPaise,
      p_timeline_months: value.timelineMonths,
      p_bank_guarantee_paise: value.bankGuaranteePaise,
      p_other_terms: value.otherTerms,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the developer, dates and offer terms.',
  );
}

export async function setMajorWorksProposalStage(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksProposalStageInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_proposal_stage_set',
    {
      p_society_id: societyId,
      p_proposal_id: value.proposalId,
      p_stage: value.stage,
      p_reason: value.reason,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an allowed stage and give a reason for rejected or withdrawn.',
  );
}

export async function addMajorWorksProposalFile(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksProposalFileInputSchema, input);
  if (!context.userId) throw new AppError('FORBIDDEN');
  const details = await verifyFileAttachment(context, {
    bucket: 'major-works-files',
    contentTypes: FILE_CONTENT_TYPES,
    maxBytes: 10 * 1024 * 1024,
    ownerPath: `${societyId}/${context.userId}/proposals`,
    path: value.path,
    societyId,
  });
  return callModuleRpc(
    context,
    'major_works_proposal_file_add',
    {
      p_society_id: societyId,
      p_proposal_id: value.proposalId,
      p_path: value.path,
      p_content_type: details.contentType,
      p_size_bytes: details.sizeBytes,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the proposal evidence file and proposal.',
  );
}

export async function setMajorWorksConsentMethod(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksConsentMethodInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_consent_method_set',
    {
      p_society_id: societyId,
      p_method: value.method,
      p_confirmed: value.confirmed,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.object({ method: z.string(), confirmed: z.boolean() }).strict(),
    'Choose a method and confirm responsibility before using poll consent.',
  );
}

export async function getMajorWorksConsents(proposalId: string) {
  const { context, societyId } = await contextFor('admin_read');
  const result = await callModuleRpc(
    context,
    'major_works_consents_get',
    {
      p_society_id: societyId,
      p_proposal_id: z.uuid().parse(proposalId),
    },
    majorWorksConsentViewSchema,
    'Could not load redevelopment consents.',
  );
  return {
    ...result,
    can_edit_settings: await canAdminEditAllModuleSettings(
      'major_works',
      context,
    ),
    records: await Promise.all(
      result.records.map(async (record) => {
        if (!record.signed_form_path) {
          return { ...record, signed_form_url: null };
        }
        const { data, error } = await context.db.storage
          .from('major-works-files')
          .createSignedUrl(record.signed_form_path, 300);
        if (error || !data) {
          throw new Error('Could not open the private consent form.', {
            cause: error,
          });
        }
        return { ...record, signed_form_url: data.signedUrl };
      }),
    ),
  };
}

export async function recordMajorWorksConsent(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksConsentRecordInputSchema, input);
  if (value.signedFormPath) {
    if (!context.userId) throw new AppError('FORBIDDEN');
    await verifyFileAttachment(context, {
      bucket: 'major-works-files',
      contentTypes: FILE_CONTENT_TYPES,
      maxBytes: 10 * 1024 * 1024,
      ownerPath: `${societyId}/${context.userId}/consents`,
      path: value.signedFormPath,
      societyId,
    });
  }
  return callModuleRpc(
    context,
    'major_works_consent_record',
    {
      p_society_id: societyId,
      p_proposal_id: value.proposalId,
      p_unit_id: value.unitId,
      p_status: value.status,
      p_signed_form_path: value.signedFormPath,
      p_expected_version: value.expectedVersion,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a valid owner unit and consent response.',
  );
}

export async function createMajorWorksConsentPoll(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksConsentPollInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_consent_poll_create',
    {
      p_society_id: societyId,
      p_proposal_id: value.proposalId,
      p_confirmed: value.confirmed,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Confirm the poll consent method and choose an active proposal.',
  );
}

export async function listMyMajorWorksConsents() {
  const { context, societyId } = await contextFor('resident_read');
  return callModuleRpc(
    context,
    'major_works_my_consents_get',
    { p_society_id: societyId },
    majorWorksMyConsentsSchema,
    'Could not load your redevelopment consent status.',
  );
}

export async function listMajorWorksMilestones(proposalId: string) {
  const { context, societyId } = await contextFor('admin_read');
  return callModuleRpc(
    context,
    'major_works_milestones_list',
    {
      p_society_id: societyId,
      p_proposal_id: z.uuid().parse(proposalId),
    },
    majorWorksMilestonesSchema,
    'Could not load redevelopment milestones.',
  );
}

export async function saveMajorWorksMilestone(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksMilestoneInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_milestone_save',
    {
      p_society_id: societyId,
      p_milestone_id: value.milestoneId,
      p_proposal_id: value.proposalId,
      p_title: value.title,
      p_planned_on: value.plannedOn,
      p_actual_on: value.actualOn,
      p_status: value.status,
      p_note: value.note,
      p_position: value.position,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the milestone date, status and position.',
  );
}

export async function getMajorWorksSummary() {
  const { context, societyId } = await contextFor('admin_read');
  return callModuleRpc(
    context,
    'major_works_summary_get',
    { p_society_id: societyId },
    majorWorksSummarySchema,
    'Could not load the major-works summary.',
  );
}

export async function archiveMajorWorksProposal(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(majorWorksProposalArchiveInputSchema, input);
  return callModuleRpc(
    context,
    'major_works_proposal_archive',
    {
      p_society_id: societyId,
      p_proposal_id: value.proposalId,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Archive only selected, rejected or withdrawn proposals.',
  );
}
