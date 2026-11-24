// Authorize P16/P39/P41 expense workflows and shape books, statements and drafts for display.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { FILE_CONTENT_TYPES, verifyFileAttachment } from '../files/attachments';
import { authorizeRequest } from '../permissions/authorize';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import {
  expenseAccountInputSchema,
  expenseAgmDraftInputSchema,
  expenseAgmDraftSchema,
  expenseAgmSettingsInputSchema,
  expenseAuditAcknowledgeInputSchema,
  expenseAuditObjectionInputSchema,
  expenseAuditQueryInputSchema,
  expenseAuditSchema,
  expenseAuditYearInputSchema,
  expenseCategoryDetailsInputSchema,
  expenseCategoryInputSchema,
  expenseDecisionInputSchema,
  expenseEntriesPageSchema,
  expenseFinancialPositionSchema,
  expenseFundActivationInputSchema,
  expenseFundAllocationInputSchema,
  expenseFundAllocationCorrectionInputSchema,
  expenseFundAllocationResultSchema,
  expenseFundCutoverQuerySchema,
  expenseFundInputSchema,
  expenseFundMappingInputSchema,
  expenseFundOpeningCorrectionInputSchema,
  expenseFixedDepositInputSchema,
  expenseFixedDepositsSchema,
  expenseFundInterestInputSchema,
  expenseFundInterestRecordsSchema,
  expenseFundTransferInputSchema,
  expenseFundTransferReverseInputSchema,
  expenseFundTransferRuleInputSchema,
  expenseFundTransfersSchema,
  expenseFundCorpusInputSchema,
  expenseFundCorpusSchema,
  expenseFundReceiptLinkInputSchema,
  expenseFundWorkInputSchema,
  expenseFundWorkLinkInputSchema,
  expenseFundWorksSchema,
  expenseFundReportSchema,
  expenseFundReconciliationInputSchema,
  expenseFundReconciliationSchema,
  expenseFundTargetInputSchema,
  expenseFundsActivitySchema,
  expenseFundBillingMappingsSchema,
  expenseBillingCollectionSuggestionsSchema,
  expenseFundsWorkspaceSchema,
  expenseStatementBalanceInputSchema,
  expenseIncomeInputSchema,
  expenseMonthCloseInputSchema,
  expenseMonthReopenInputSchema,
  expenseMultiYearSchema,
  expensePageSchema,
  expensePayeeMappingInputSchema,
  expensePayeeMappingRemoveInputSchema,
  expenseRangeSchema,
  expenseRecordInputSchema,
  expenseRecordResultSchema,
  expenseReportSchema,
  expenseReverseInputSchema,
  expenseSavingsDetailSchema,
  expenseSavingsEvidenceInputSchema,
  expenseSavingsEvidenceVoidInputSchema,
  expenseSavingsInputSchema,
  expenseSavingsListSchema,
  expenseSavingsStatusInputSchema,
  expenseSettingsInputSchema,
  expenseStatementsSchema,
  expenseTransferInputSchema,
  expenseTransferReverseInputSchema,
  expenseVendorSpendInputSchema,
  expenseVendorSpendSchema,
  expenseWorkspaceSchema,
  EXPENSE_STATUSES,
  cashCountInputSchema,
  pettyCashAssignInputSchema,
  pettyCashViewSchema,
  reconciliationSchema,
  statementItemCancelInputSchema,
  statementItemInputSchema,
  statementItemMatchInputSchema,
} from './validation';

type Access = 'read' | 'manage' | 'approve';
const PERMISSIONS: Record<Access, string> = {
  read: 'expense:list',
  manage: 'expense:manage',
  approve: 'expense:approve',
};
export const EXPENSE_PAGE_SIZE = 50;

async function expenseContext(access: Access, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'expense',
    permission: PERMISSIONS[access],
    write: access !== 'read',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

async function signReceipt(context: RequestContext, path: string | null) {
  if (!path) return null;
  const { data, error } = await context.db.storage
    .from('expense-files')
    .createSignedUrl(path, 300);
  if (error || !data)
    throw new Error('Could not open the private expense receipt.', {
      cause: error,
    });
  return data.signedUrl;
}

async function withReceiptUrls<T extends { receipt_path: string | null }>(
  context: RequestContext,
  rows: T[],
) {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      receiptUrl: await signReceipt(context, row.receipt_path),
    })),
  );
}

async function expenseSocietyName(context: RequestContext, societyId: string) {
  const { data, error } = await context.db
    .from('societies')
    .select('name')
    .eq('id', societyId)
    .single();
  if (error || !data)
    throw new Error('Could not load the society name.', { cause: error });
  return data.name;
}

function pageOffset(page: number) {
  return (Math.max(1, Math.floor(page)) - 1) * EXPENSE_PAGE_SIZE;
}

export async function getExpenseWorkspace() {
  const { context, societyId } = await expenseContext('read');
  const [workspace, pending] = await Promise.all([
    callModuleRpc(
      context,
      'expense_workspace',
      { p_society_id: societyId },
      expenseWorkspaceSchema,
      'Could not load society accounts.',
    ),
    callModuleRpc(
      context,
      'expense_expenses_page',
      {
        p_society_id: societyId,
        p_status: 'pending_approval',
        p_limit: 100,
        p_offset: 0,
      },
      expensePageSchema,
      'Could not load expenses awaiting approval.',
    ),
  ]);
  return {
    ...workspace,
    pending: await withReceiptUrls(context, pending.rows),
    pendingTotal: pending.total,
  };
}

export async function listExpenses(status: string | undefined, page: number) {
  const { context, societyId } = await expenseContext('read');
  const filter = z.enum(EXPENSE_STATUSES).safeParse(status);
  const result = await callModuleRpc(
    context,
    'expense_expenses_page',
    {
      p_society_id: societyId,
      p_status: filter.success ? filter.data : null,
      p_limit: EXPENSE_PAGE_SIZE,
      p_offset: pageOffset(page),
    },
    expensePageSchema,
    'Could not load expenses.',
  );
  return { ...result, rows: await withReceiptUrls(context, result.rows) };
}

export async function listExpenseEntries(
  range: unknown,
  accountId: string | null,
  page: number,
) {
  const { context, societyId } = await expenseContext('read');
  const { from, to } = parseModuleInput(expenseRangeSchema, range);
  const account = z.uuid().nullable().safeParse(accountId);
  const result = await callModuleRpc(
    context,
    'expense_entries_page',
    {
      p_society_id: societyId,
      p_from: from,
      p_to: to,
      p_account_id: account.success ? account.data : null,
      p_limit: EXPENSE_PAGE_SIZE,
      p_offset: pageOffset(page),
    },
    expenseEntriesPageSchema,
    'Could not load the cash and bank book.',
  );
  return { ...result, rows: await withReceiptUrls(context, result.rows) };
}

export async function getExpenseReport(range: unknown) {
  const { context, societyId } = await expenseContext('read');
  const { from, to } = parseModuleInput(expenseRangeSchema, range);
  return callModuleRpc(
    context,
    'expense_report',
    { p_society_id: societyId, p_from: from, p_to: to },
    expenseReportSchema,
    'Choose a valid report range of up to two years.',
  );
}

export async function getExpenseVendorSpend(input: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(expenseVendorSpendInputSchema, input);
  return callModuleRpc(
    context,
    'expense_vendor_spend_report',
    {
      p_society_id: societyId,
      p_from: parsed.from,
      p_to: parsed.to,
      p_category_id: parsed.categoryId,
      p_group: parsed.group,
      p_cost_nature: parsed.costNature,
    },
    expenseVendorSpendSchema,
    'Choose a valid vendor-spend range and filters.',
  );
}

export async function listExpenseSavings() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_savings_list',
    { p_society_id: societyId },
    expenseSavingsListSchema,
    'Could not load savings initiatives.',
  );
}

export async function getExpenseSavings(id: unknown) {
  const { context, societyId } = await expenseContext('read');
  const initiativeId = parseModuleInput(z.uuid(), id);
  const detail = await callModuleRpc(
    context,
    'expense_savings_get',
    { p_society_id: societyId, p_initiative_id: initiativeId },
    expenseSavingsDetailSchema,
    'Could not load this savings initiative.',
  );
  return {
    ...detail,
    evidence: await Promise.all(
      detail.evidence.map(async (evidence) => ({
        ...evidence,
        fileUrl: await signReceipt(context, evidence.file_path),
      })),
    ),
  };
}

export async function getExpenseStatements(range: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(expenseRangeSchema, range);
  return callModuleRpc(
    context,
    'expense_statements',
    { p_society_id: societyId, p_from: parsed.from, p_to: parsed.to },
    expenseStatementsSchema,
    'Choose a valid statement range of up to two years.',
  );
}

export async function getExpenseFinancialPosition(asOf: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(z.iso.date(), asOf);
  return callModuleRpc(
    context,
    'expense_financial_position',
    { p_society_id: societyId, p_as_of: parsed },
    expenseFinancialPositionSchema,
    'Choose today or an earlier financial-position date.',
  );
}

export async function getExpenseMultiYear() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_multi_year',
    { p_society_id: societyId },
    expenseMultiYearSchema,
    'Could not load the five-year comparison.',
  );
}

export async function getExpenseAudit(financialYearStart: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(
    z.iso.date().refine((value) => value.endsWith('-04-01')),
    financialYearStart,
  );
  return callModuleRpc(
    context,
    'expense_audit_get',
    {
      p_society_id: societyId,
      p_financial_year_start: parsed,
    },
    expenseAuditSchema,
    'Choose an April-to-March financial year.',
  );
}

export async function getExpenseAgmDraft(financialYearStart: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(
    z.iso.date().refine((value) => value.endsWith('-04-01')),
    financialYearStart,
  );
  return callModuleRpc(
    context,
    'expense_agm_draft',
    {
      p_society_id: societyId,
      p_financial_year_start: parsed,
    },
    expenseAgmDraftSchema,
    'Choose an April-to-March financial year.',
  );
}

export async function getExpenseFunds(cutover: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = expenseFundCutoverQuerySchema.safeParse(cutover);
  return callModuleRpc(
    context,
    'expense_funds_workspace',
    {
      p_society_id: societyId,
      p_cutover_on: parsed.success ? (parsed.data ?? null) : null,
    },
    expenseFundsWorkspaceSchema,
    'Could not load society funds.',
  );
}

export async function getExpenseFundActivity(page: number) {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_funds_activity_transfers',
    {
      p_society_id: societyId,
      p_limit: 50,
      p_offset: pageOffset(page),
    },
    expenseFundsActivitySchema,
    'Could not load fund balances and allocations.',
  );
}

export async function getExpenseFundBillingMappings() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_fund_billing_mappings_list',
    { p_society_id: societyId },
    expenseFundBillingMappingsSchema,
    'Could not load Billing charge fund mappings.',
  );
}

export async function getExpenseBillingCollectionSuggestions() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_billing_collection_suggestions',
    { p_society_id: societyId, p_limit: 200 },
    expenseBillingCollectionSuggestionsSchema,
    'Could not load Billing collection suggestions.',
  );
}

// Exports read every entry in the range, a page at a time.
export async function exportExpenseEntries(range: unknown) {
  const { context, societyId } = await expenseContext('read');
  const { from, to } = parseModuleInput(expenseRangeSchema, range);
  const rows: z.infer<typeof expenseEntriesPageSchema>['rows'] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await callModuleRpc(
      context,
      'expense_entries_page',
      {
        p_society_id: societyId,
        p_from: from,
        p_to: to,
        p_account_id: null,
        p_limit: 1000,
        p_offset: offset,
      },
      expenseEntriesPageSchema,
      'Could not export the cash and bank book.',
    );
    rows.push(...page.rows);
    if (rows.length >= page.total || page.rows.length === 0) break;
  }
  const report = await callModuleRpc(
    context,
    'expense_report',
    { p_society_id: societyId, p_from: from, p_to: to },
    expenseReportSchema,
    'Could not export the report.',
  );
  return {
    rows,
    report,
    societyName: await expenseSocietyName(context, societyId),
  };
}

export async function exportExpenseVendorSpend(input: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(expenseVendorSpendInputSchema, input);
  const report = await callModuleRpc(
    context,
    'expense_vendor_spend_report',
    {
      p_society_id: societyId,
      p_from: parsed.from,
      p_to: parsed.to,
      p_category_id: parsed.categoryId,
      p_group: parsed.group,
      p_cost_nature: parsed.costNature,
    },
    expenseVendorSpendSchema,
    'Could not export the vendor spend report.',
  );
  return {
    report,
    societyName: await expenseSocietyName(context, societyId),
  };
}

export async function exportExpenseStatements(range: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(expenseRangeSchema, range);
  const statements = await callModuleRpc(
    context,
    'expense_statements',
    { p_society_id: societyId, p_from: parsed.from, p_to: parsed.to },
    expenseStatementsSchema,
    'Could not export the financial statements.',
  );
  return {
    statements,
    societyName: await expenseSocietyName(context, societyId),
  };
}

export async function exportExpenseFinancialPosition(asOf: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(z.iso.date(), asOf);
  const position = await callModuleRpc(
    context,
    'expense_financial_position',
    { p_society_id: societyId, p_as_of: parsed },
    expenseFinancialPositionSchema,
    'Could not export the financial-position summary.',
  );
  return {
    position,
    societyName: await expenseSocietyName(context, societyId),
  };
}

export async function exportExpenseAgmDraft(financialYearStart: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(
    z.iso.date().refine((value) => value.endsWith('-04-01')),
    financialYearStart,
  );
  const today = await callModuleRpc(
    context,
    'expense_workspace',
    { p_society_id: societyId },
    expenseWorkspaceSchema,
    'Could not load the Accounts date.',
  );
  const yearEnd = new Date(`${parsed}T00:00:00Z`);
  yearEnd.setUTCFullYear(yearEnd.getUTCFullYear() + 1);
  yearEnd.setUTCDate(0);
  const reportEnd = yearEnd.toISOString().slice(0, 10);
  const to = today.today < reportEnd ? today.today : reportEnd;
  const [statements, position, comparison, audit, draft] = await Promise.all([
    callModuleRpc(
      context,
      'expense_statements',
      { p_society_id: societyId, p_from: parsed, p_to: to },
      expenseStatementsSchema,
      'Could not load the AGM finances.',
    ),
    callModuleRpc(
      context,
      'expense_financial_position',
      { p_society_id: societyId, p_as_of: to },
      expenseFinancialPositionSchema,
      'Could not load the AGM financial-position summary.',
    ),
    callModuleRpc(
      context,
      'expense_multi_year',
      { p_society_id: societyId },
      expenseMultiYearSchema,
      'Could not load the AGM comparison.',
    ),
    callModuleRpc(
      context,
      'expense_audit_get',
      { p_society_id: societyId, p_financial_year_start: parsed },
      expenseAuditSchema,
      'Could not load the AGM audit status.',
    ),
    callModuleRpc(
      context,
      'expense_agm_draft',
      { p_society_id: societyId, p_financial_year_start: parsed },
      expenseAgmDraftSchema,
      'Could not load the AGM draft.',
    ),
  ]);
  if (!draft.warning_acknowledged_at) throw new AppError('FORBIDDEN');
  return {
    statements,
    position,
    comparison,
    audit,
    draft,
    societyName: await expenseSocietyName(context, societyId),
  };
}

export async function saveExpenseSettings(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseSettingsInputSchema, input);
  await callModuleRpc(
    context,
    'expense_settings_update',
    {
      p_society_id: societyId,
      p_approval_threshold_paise: v.thresholdRupees,
      p_billing_income_account_id: v.billingIncomeAccountId,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.object({ updated_at: z.string() }),
    'Choose an active bank account and a valid approval limit.',
  );
}

export async function acknowledgeExpenseAuditWarning(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseAuditAcknowledgeInputSchema, input);
  return callModuleRpc(
    context,
    'expense_audit_warning_acknowledge',
    {
      p_society_id: societyId,
      p_acknowledged: parsed.acknowledged,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.iso.datetime({ offset: true }),
    'Acknowledge the audit and AGM warning.',
  );
}

export async function saveExpenseAuditYear(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseAuditYearInputSchema, input);
  return callModuleRpc(
    context,
    'expense_audit_year_save',
    {
      p_society_id: societyId,
      p_year_id: parsed.yearId,
      p_financial_year_start: parsed.financialYearStart,
      p_auditor_name: parsed.auditorName,
      p_auditor_firm: parsed.auditorFirm,
      p_appointed_on: parsed.appointedOn,
      p_appointment_reference: parsed.appointmentReference,
      p_appointment_document_id: parsed.appointmentDocumentId,
      p_report_received_on: parsed.reportReceivedOn,
      p_placed_before_agm_on: parsed.placedBeforeAgmOn,
      p_filed_on: parsed.filedOn,
      p_opinion: parsed.opinion,
      p_opinion_text: parsed.opinionText,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the audit year, report dates, copied opinion and warning acknowledgement.',
  );
}

export async function saveExpenseAuditQuery(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseAuditQueryInputSchema, input);
  return callModuleRpc(
    context,
    'expense_audit_query_save',
    {
      p_society_id: societyId,
      p_query_id: parsed.queryId,
      p_audit_year_id: parsed.auditYearId,
      p_query_number: parsed.queryNumber,
      p_query_date: parsed.queryDate,
      p_area: parsed.area,
      p_question: parsed.question,
      p_assignee_user_id: parsed.assigneeUserId,
      p_due_date: parsed.dueDate,
      p_response: parsed.response,
      p_response_date: parsed.responseDate,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the query, assignee, due date and response.',
  );
}

export async function saveExpenseAuditObjection(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseAuditObjectionInputSchema, input);
  return callModuleRpc(
    context,
    'expense_audit_objection_save',
    {
      p_society_id: societyId,
      p_objection_id: parsed.objectionId,
      p_audit_year_id: parsed.auditYearId,
      p_description: parsed.description,
      p_owner_user_id: parsed.ownerUserId,
      p_due_date: parsed.dueDate,
      p_correction_note: parsed.correctionNote,
      p_corrected_on: parsed.correctedOn,
      p_evidence_document_id: parsed.evidenceDocumentId,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the objection, owner, correction and evidence document.',
  );
}

export async function saveExpenseAgmDraft(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseAgmDraftInputSchema, input);
  return callModuleRpc(
    context,
    'expense_agm_draft_save',
    {
      p_society_id: societyId,
      p_draft_id: parsed.draftId,
      p_financial_year_start: parsed.financialYearStart,
      p_written_sections: parsed.writtenSections,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the AGM sections and acknowledge the warning.',
  );
}

export async function saveExpenseAgmSettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseAgmSettingsInputSchema, input);
  return callModuleRpc(
    context,
    'expense_agm_settings_save',
    {
      p_society_id: societyId,
      p_sections: parsed.sections,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.iso.datetime({ offset: true }),
    'Choose the AGM report sections and refresh if the settings changed.',
  );
}

export async function saveExpenseAccount(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseAccountInputSchema, input);
  return callModuleRpc(
    context,
    'expense_account_save',
    {
      p_society_id: societyId,
      p_account_id: v.accountId,
      p_name: v.name,
      p_account_type: v.accountType,
      p_opening_balance_paise: v.openingBalanceRupees,
      p_opening_on: v.openingOn,
      p_active: v.active,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the account. Opening details are fixed once used, the opening date cannot be in the future, and the billing income account must stay active.',
  );
}

export async function saveExpenseCategory(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseCategoryInputSchema, input);
  return callModuleRpc(
    context,
    'expense_category_save',
    {
      p_society_id: societyId,
      p_category_id: v.categoryId,
      p_name: v.name,
      p_active: v.active,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the category name.',
  );
}

export async function saveExpenseCategoryDetails(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseCategoryDetailsInputSchema, input);
  return callModuleRpc(
    context,
    'expense_category_details_save',
    {
      p_society_id: societyId,
      p_category_id: parsed.categoryId,
      p_detail_group: parsed.detailGroup,
      p_cost_nature: parsed.costNature,
      p_owner_user_id: parsed.ownerUserId,
      p_detail_description: parsed.detailDescription,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the category details and choose an active admin or committee owner.',
  );
}

export async function saveExpensePayeeMapping(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expensePayeeMappingInputSchema, input);
  return callModuleRpc(
    context,
    'expense_payee_mapping_save',
    {
      p_society_id: societyId,
      p_payee: parsed.payee,
      p_vendor_id: parsed.vendorId,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an active vendor and check the payee mapping.',
  );
}

export async function removeExpensePayeeMapping(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expensePayeeMappingRemoveInputSchema, input);
  return callModuleRpc(
    context,
    'expense_payee_mapping_remove',
    {
      p_society_id: societyId,
      p_mapping_id: parsed.mappingId,
      p_reason: parsed.reason,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason for removing this payee mapping.',
  );
}

export async function saveExpenseSavings(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseSavingsInputSchema, input);
  return callModuleRpc(
    context,
    'expense_savings_save',
    {
      p_society_id: societyId,
      p_initiative_id: parsed.initiativeId,
      p_title: parsed.title,
      p_description: parsed.description,
      p_kind: parsed.kind,
      p_owner_user_id: parsed.ownerUserId,
      p_category_id: parsed.categoryId,
      p_vendor_id: parsed.vendorId,
      p_baseline_annual_paise: parsed.baselineAnnualRupees,
      p_expected_annual_paise: parsed.expectedAnnualRupees,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the savings initiative and its active owner, category and vendor.',
  );
}

export async function changeExpenseSavingsStatus(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseSavingsStatusInputSchema, input);
  return callModuleRpc(
    context,
    'expense_savings_status_change',
    {
      p_society_id: societyId,
      p_initiative_id: parsed.initiativeId,
      p_to_status: parsed.status,
      p_reason: parsed.reason,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the status change and evidence. Dropping or restoring needs a reason.',
  );
}

export async function addExpenseSavingsEvidence(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseSavingsEvidenceInputSchema, input);
  if (parsed.filePath) {
    await verifyFileAttachment(context, {
      bucket: 'expense-files',
      contentTypes: FILE_CONTENT_TYPES,
      ownerPath: `${societyId}/savings/${parsed.initiativeId}`,
      path: parsed.filePath,
      societyId,
    });
  }
  return callModuleRpc(
    context,
    'expense_savings_evidence_add',
    {
      p_society_id: societyId,
      p_initiative_id: parsed.initiativeId,
      p_amount_paise: parsed.amountRupees,
      p_evidenced_on: parsed.evidencedOn,
      p_note: parsed.note,
      p_entry_id: parsed.entryId,
      p_vendor_bill_id: parsed.vendorBillId,
      p_vendor_contract_id: parsed.vendorContractId,
      p_file_path: parsed.filePath,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the evidence date, amount, note, source link and attachment.',
  );
}

export async function voidExpenseSavingsEvidence(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseSavingsEvidenceVoidInputSchema, input);
  return callModuleRpc(
    context,
    'expense_savings_evidence_void',
    {
      p_society_id: societyId,
      p_evidence_id: parsed.evidenceId,
      p_reason: parsed.reason,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason for voiding this evidence record.',
  );
}

export async function saveExpenseFund(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_save',
    {
      p_society_id: societyId,
      p_fund_id: v.fundId,
      p_name: v.name,
      p_active: v.active,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the fund name. A fund can be deactivated but not removed once it is used.',
  );
}

export async function activateExpenseFunds(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundActivationInputSchema, input);
  return callModuleRpc(
    context,
    'expense_funds_activate',
    {
      p_society_id: societyId,
      p_cutover_on: v.cutoverOn,
      p_allocations: v.allocations.map((allocation) => ({
        fund_id: allocation.fundId,
        amount_paise: allocation.amountRupees,
      })),
      p_acknowledged: v.acknowledged,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the cutover, close the previous month, acknowledge the warning and keep the fund openings within the non-negative Accounts total.',
  );
}

export async function saveExpenseFundMapping(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundMappingInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_mapping_save',
    {
      p_society_id: societyId,
      p_source_kind: v.sourceKind,
      p_source_id: v.sourceId,
      p_income_kind: v.incomeKind,
      p_fund_id: v.fundId,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an active fund and a valid expense category or income type.',
  );
}

export async function confirmExpenseFundAllocations(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundAllocationInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_allocations_confirm',
    {
      p_society_id: societyId,
      p_items: v.items.map((item) => ({
        entry_id: item.entryId,
        allocations: item.allocations.map((allocation) => ({
          fund_id: allocation.fundId,
          amount_paise: allocation.amountRupees,
        })),
      })),
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    expenseFundAllocationResultSchema,
    'Check the allocations. Each entry must equal its allocation total, and closed months are listed as skipped.',
  );
}

export async function correctExpenseFundOpening(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundOpeningCorrectionInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_opening_correct',
    {
      p_society_id: societyId,
      p_allocations: v.allocations.map((allocation) => ({
        fund_id: allocation.fundId,
        amount_paise: allocation.amountRupees,
      })),
      p_reason: v.reason,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason, close the previous month and keep the corrected opening within the current non-negative Accounts total.',
  );
}

export async function correctExpenseFundAllocation(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundAllocationCorrectionInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_allocation_correct',
    {
      p_society_id: societyId,
      p_entry_id: v.entryId,
      p_allocations: v.allocations.map((allocation) => ({
        fund_id: allocation.fundId,
        amount_paise: allocation.amountRupees,
      })),
      p_reason: v.reason,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason, reopen the month if closed, and keep the corrected split equal to the Accounts entry.',
  );
}

export async function getExpenseFixedDeposits() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_fixed_deposits_list',
    { p_society_id: societyId },
    expenseFixedDepositsSchema,
    'Could not load fixed deposits.',
  );
}

export async function saveExpenseFixedDeposit(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFixedDepositInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fixed_deposit_save',
    {
      p_society_id: societyId,
      p_deposit_id: v.depositId,
      p_predecessor_id: v.predecessorId,
      p_fund_id: v.fundId,
      p_account_id: v.accountId,
      p_bank_name: v.bankName,
      p_reference: v.reference,
      p_principal_paise: v.principalRupees,
      p_quoted_rate: v.quotedRate,
      p_deposit_on: v.depositOn,
      p_maturity_on: v.maturityOn,
      p_maturity_value_paise: v.maturityValueRupees,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the fund, deposit account and bank-confirmed deposit terms. A renewal keeps the same account and fund.',
  );
}

export async function getExpenseFundInterestRecords() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_fund_interest_list',
    { p_society_id: societyId },
    expenseFundInterestRecordsSchema,
    'Could not load interest and TDS records.',
  );
}

export async function saveExpenseFundInterest(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundInterestInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_interest_save',
    {
      p_society_id: societyId,
      p_record_id: v.recordId,
      p_fund_id: v.fundId,
      p_fixed_deposit_id: v.fixedDepositId,
      p_income_entry_id: v.incomeEntryId,
      p_source_label: v.sourceLabel,
      p_period_from: v.periodFrom,
      p_period_to: v.periodTo,
      p_gross_interest_paise: v.grossInterestRupees,
      p_tax_withheld_paise: v.taxWithheldRupees,
      p_actual_credit_paise: v.actualCreditRupees,
      p_average_balance_paise: v.averageBalanceRupees,
      p_note: v.note,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the fund, dates, source, bank amounts and linked Accounts interest income.',
  );
}

export async function getExpenseFundTransfers() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_fund_transfers_list',
    { p_society_id: societyId },
    expenseFundTransfersSchema,
    'Could not load fund transfer rules and records.',
  );
}

export async function saveExpenseFundTransferRule(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundTransferRuleInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_transfer_rule_save',
    {
      p_society_id: societyId,
      p_rule_id: v.ruleId,
      p_from_fund_id: v.fromFundId,
      p_to_fund_id: v.toFundId,
      p_active: v.active,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose two active funds. Existing transfer pairs cannot be changed; deactivate the rule instead.',
  );
}

export async function recordExpenseFundTransfer(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundTransferInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_transfer_record',
    {
      p_society_id: societyId,
      p_from_fund_id: v.fromFundId,
      p_to_fund_id: v.toFundId,
      p_transfer_on: v.transferOn,
      p_amount_paise: v.amountRupees,
      p_reason: v.reason,
      p_decision_reference: v.decisionReference,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a configured fund pair and an available source-fund balance. This moves allocation only, not bank money.',
  );
}

export async function reverseExpenseFundTransfer(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundTransferReverseInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_transfer_reverse',
    {
      p_society_id: societyId,
      p_transfer_id: v.transferId,
      p_reverse_on: v.reverseOn,
      p_reason: v.reason,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give a reason and reverse the allocation transfer on or after its original date.',
  );
}

export async function getExpenseFundCorpus() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_fund_corpus_list',
    { p_society_id: societyId },
    expenseFundCorpusSchema,
    'Could not load corpus records.',
  );
}

export async function saveExpenseFundCorpus(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundCorpusInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_corpus_save',
    {
      p_society_id: societyId,
      p_record_id: v.recordId,
      p_unit_id: v.unitId,
      p_fund_id: v.fundId,
      p_event_description: v.eventDescription,
      p_event_on: v.eventOn,
      p_reported_amount_paise: v.reportedAmountRupees,
      p_concession_paise: v.concessionRupees,
      p_concession_reason: v.concessionReason,
      p_decision_reference: v.decisionReference,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the unit, fund, reported amount, concession and decision reference.',
  );
}

export async function linkExpenseFundReceipt(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundReceiptLinkInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_receipt_link',
    {
      p_society_id: societyId,
      p_corpus_record_id: v.corpusRecordId,
      p_entry_id: v.entryId,
      p_amount_paise: v.amountRupees,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an unreversed Accounts receipt allocated to this fund and stay within both source and corpus caps.',
  );
}

export async function getExpenseFundWorks() {
  const { context, societyId } = await expenseContext('read');
  return callModuleRpc(
    context,
    'expense_fund_works_list',
    { p_society_id: societyId },
    expenseFundWorksSchema,
    'Could not load sanctioned work.',
  );
}

export async function saveExpenseFundWork(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundWorkInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_work_save',
    {
      p_society_id: societyId,
      p_work_id: v.workId,
      p_fund_id: v.fundId,
      p_title: v.title,
      p_sanctioned_amount_paise: v.sanctionedAmountRupees,
      p_sanctioned_on: v.sanctionedOn,
      p_valid_until: v.validUntil,
      p_meeting_resolution_id: v.meetingResolutionId,
      p_external_reference: v.externalReference,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose a passed Homeish resolution or an external reference, plus a fund and valid sanction details.',
  );
}

export async function linkExpenseFundWork(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseFundWorkLinkInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_work_link',
    {
      p_society_id: societyId,
      p_work_id: v.workId,
      p_entry_id: v.entryId,
      p_amount_paise: v.amountRupees,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an unreversed posted expense in this fund and stay within its unlinked allocation and sanctioned amount.',
  );
}

export async function getExpenseFundReport(range: {
  from: string;
  to: string;
}) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(expenseRangeSchema, range);
  return callModuleRpc(
    context,
    'expense_fund_report',
    { p_society_id: societyId, p_from: parsed.from, p_to: parsed.to },
    expenseFundReportSchema,
    'Choose a valid fund report range of up to two years.',
  );
}

export async function getExpenseFundReconciliation(month: unknown) {
  const { context, societyId } = await expenseContext('read');
  const parsed = parseModuleInput(expenseFundReconciliationInputSchema, {
    month,
  });
  return callModuleRpc(
    context,
    'expense_fund_reconciliation',
    { p_society_id: societyId, p_month: parsed.month },
    expenseFundReconciliationSchema,
    'Choose a valid fund reconciliation month.',
  );
}

export async function saveExpenseFundTarget(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseFundTargetInputSchema, input);
  return callModuleRpc(
    context,
    'expense_fund_target_save',
    {
      p_society_id: societyId,
      p_fund_id: parsed.fundId,
      p_target_paise: parsed.targetRupees,
      p_target_date: parsed.targetDate,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the fund target amount and date, then refresh the fund if it changed.',
  );
}

export async function saveExpenseStatementBalance(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseStatementBalanceInputSchema, input);
  return callModuleRpc(
    context,
    'expense_statement_balance_save',
    {
      p_society_id: societyId,
      p_account_id: parsed.accountId,
      p_month: parsed.month,
      p_closing_paise: parsed.closingRupees,
      p_note: parsed.note,
      p_reason: parsed.reason,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the statement balance. Existing values need a reason and fresh version.',
  );
}

export async function exportExpenseFundReconciliation(month: unknown) {
  const requestId = createRequestId();
  const { context, societyId } = await expenseContext('manage', requestId);
  const parsed = parseModuleInput(expenseFundReconciliationInputSchema, {
    month,
  });
  await callModuleRpc(
    context,
    'expense_fund_reconciliation_export_record',
    {
      p_society_id: societyId,
      p_month: parsed.month,
      p_request_trace: requestId,
    },
    z.null(),
    'The fund reconciliation export could not be audited.',
  );
  const report = await callModuleRpc(
    context,
    'expense_fund_reconciliation',
    { p_society_id: societyId, p_month: parsed.month },
    expenseFundReconciliationSchema,
    'Choose a valid fund reconciliation month.',
  );
  return report;
}

export async function recordExpense(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseRecordInputSchema, input);
  if (v.receiptPath)
    await verifyFileAttachment(context, {
      bucket: 'expense-files',
      contentTypes: FILE_CONTENT_TYPES,
      societyId,
      path: v.receiptPath,
      ownerPath: `${societyId}/${context.userId}/expense`,
    });
  return callModuleRpc(
    context,
    'expense_record',
    {
      p_society_id: societyId,
      p_account_id: v.accountId,
      p_category_id: v.categoryId,
      p_spent_on: v.spentOn,
      p_payee: v.payee,
      p_amount_paise: v.amountRupees,
      p_payment_mode: v.paymentMode,
      p_reference: v.reference,
      p_description: v.description,
      p_receipt_path: v.receiptPath,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    expenseRecordResultSchema,
    'Check the expense. Cash payments use the cash account, other modes use a bank account, and the date must be on or after the account opened, not in the future and not in a closed month.',
  );
}

export async function decideExpense(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('approve', requestId);
  const v = parseModuleInput(expenseDecisionInputSchema, input);
  return callModuleRpc(
    context,
    'expense_decide',
    {
      p_society_id: societyId,
      p_expense_id: v.expenseId,
      p_approve: v.approve,
      p_note: v.note,
      p_request_trace: requestId,
    },
    expenseRecordResultSchema,
    'This expense cannot be approved now. Its account may be inactive or its month closed.',
  );
}

export async function recordIncome(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseIncomeInputSchema, input);
  return callModuleRpc(
    context,
    'expense_income_record',
    {
      p_society_id: societyId,
      p_account_id: v.accountId,
      p_received_on: v.receivedOn,
      p_income_kind: v.incomeKind,
      p_payer: v.payer,
      p_amount_paise: v.amountRupees,
      p_reference: v.reference,
      p_description: v.description,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the income. The date must be on or after the account opened, not in the future and not in a closed month.',
  );
}

export async function reverseExpenseEntry(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseReverseInputSchema, input);
  return callModuleRpc(
    context,
    'expense_entry_reverse',
    {
      p_society_id: societyId,
      p_entry_id: v.entryId,
      p_reverse_on: v.reverseOn,
      p_reason: v.reason,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Only expenses and manual income can be reversed, on or after their date, in an open month.',
  );
}

export async function recordExpenseTransfer(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseTransferInputSchema, input);
  return callModuleRpc(
    context,
    'expense_transfer_record',
    {
      p_society_id: societyId,
      p_from_account_id: v.fromAccountId,
      p_to_account_id: v.toAccountId,
      p_transfer_on: v.transferOn,
      p_amount_paise: v.amountRupees,
      p_reference: v.reference,
      p_note: v.note,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose two active Accounts, an allowed date and a valid amount. Transfers move money between the society’s own accounts but never count as income or expense.',
  );
}

export async function reverseExpenseTransfer(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseTransferReverseInputSchema, input);
  return callModuleRpc(
    context,
    'expense_transfer_reverse',
    {
      p_society_id: societyId,
      p_transfer_pair_id: v.transferPairId,
      p_reverse_on: v.reverseOn,
      p_reason: v.reason,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Reverse both transfer legs together, on or after the transfer date and in open months.',
  );
}

export async function closeExpenseMonth(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseMonthCloseInputSchema, input);
  await callModuleRpc(
    context,
    'expense_month_close',
    { p_society_id: societyId, p_month: v.month, p_request_trace: requestId },
    z.null(),
    'Only finished months without expenses awaiting approval can be closed.',
  );
}

export async function reopenExpenseMonth(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(expenseMonthReopenInputSchema, input);
  await callModuleRpc(
    context,
    'expense_month_reopen',
    {
      p_society_id: societyId,
      p_month: v.month,
      p_reason: v.reason,
      p_request_trace: requestId,
    },
    z.null(),
    'Give a reason to reopen the month.',
  );
}

export async function getReconciliation(accountId: string, page: number) {
  const { context, societyId } = await expenseContext('read');
  const account = parseModuleInput(z.uuid(), accountId);
  return callModuleRpc(
    context,
    'expense_reconciliation_page',
    {
      p_society_id: societyId,
      p_account_id: account,
      p_limit: EXPENSE_PAGE_SIZE,
      p_offset: pageOffset(page),
    },
    reconciliationSchema,
    'Choose a bank account.',
  );
}

export async function recordStatementItem(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(statementItemInputSchema, input);
  return callModuleRpc(
    context,
    'expense_statement_item_record',
    {
      p_society_id: societyId,
      p_account_id: v.accountId,
      p_statement_date: v.statementDate,
      p_reference: v.reference,
      p_party: v.party,
      p_direction: v.direction,
      p_amount_paise: v.amountRupees,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the statement item. It needs a bank account and a date that is not in the future.',
  );
}

export async function matchStatementItem(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(statementItemMatchInputSchema, input);
  await callModuleRpc(
    context,
    'expense_statement_item_match',
    {
      p_society_id: societyId,
      p_item_id: v.itemId,
      p_entry_id: v.entryId,
      p_request_trace: requestId,
    },
    z.null(),
    'Match an entry on the same account with the same amount and direction.',
  );
}

export async function cancelStatementItem(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(statementItemCancelInputSchema, input);
  await callModuleRpc(
    context,
    'expense_statement_item_cancel',
    {
      p_society_id: societyId,
      p_item_id: v.itemId,
      p_reason: v.reason,
      p_request_trace: requestId,
    },
    z.null(),
    'Give a reason for cancelling.',
  );
}

export async function assignPettyCash(input: unknown, requestId: string) {
  const { context, societyId } = await expenseContext('manage', requestId);
  const v = parseModuleInput(pettyCashAssignInputSchema, input);
  return callModuleRpc(
    context,
    'expense_petty_cash_assign',
    {
      p_society_id: societyId,
      p_account_id: v.accountId,
      p_custodian_user_id: v.custodianUserId,
      p_handover_count_paise: v.handoverCountRupees,
      p_handover_note: v.handoverNote,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose the active cash account and an active member. Changing the custodian needs the handover count.',
  );
}

// Custody is per person in the database, so no role permission is checked here.
async function pettyCashContext(write: boolean, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'expense', write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getPettyCash() {
  const { context, societyId } = await pettyCashContext(false);
  return callModuleRpc(
    context,
    'expense_petty_cash_view',
    { p_society_id: societyId },
    pettyCashViewSchema,
    'Could not load petty cash.',
  );
}

export async function recordCashCount(input: unknown, requestId: string) {
  const { context, societyId } = await pettyCashContext(true, requestId);
  const v = parseModuleInput(cashCountInputSchema, input);
  return callModuleRpc(
    context,
    'expense_cash_count_record',
    {
      p_society_id: societyId,
      p_count_date: v.countDate,
      p_counted_paise: v.countedRupees,
      p_note: v.note,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the count. The date must be on or after the account opened and not in the future.',
  );
}

// Navigation helper: never throws, so a shell can always render.
export async function isPettyCashCustodian(context: RequestContext) {
  if (!context.societyId || !context.enabledModules.has('expense'))
    return false;
  try {
    const result = await invokeUntypedRpc<unknown>(
      context.db,
      'expense_petty_cash_custodian_check',
      { p_society_id: context.societyId },
    );
    return result === true;
  } catch {
    return false;
  }
}
