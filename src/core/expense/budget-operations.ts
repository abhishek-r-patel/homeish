// Authorize and validate P42.5 yearly budget reads and mutations.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { getModuleSettingAccess } from '../modules/setting-access';
import {
  expenseBudgetApproveInputSchema,
  expenseBudgetChangeInputSchema,
  expenseBudgetCopyPreviewInputSchema,
  expenseBudgetCopyPreviewSchema,
  expenseBudgetDiscardInputSchema,
  expenseBudgetDraftInputSchema,
  expenseBudgetFinancialYearSchema,
  expenseBudgetReportInputSchema,
  expenseBudgetReportSchema,
  expenseBudgetResidentSummarySchema,
  expenseBudgetSchema,
  expenseBudgetSettingsInputSchema,
  expenseBudgetVoidInputSchema,
} from './budget-validation';

type Access = 'read' | 'manage';
const PERMISSIONS: Record<Access, string> = {
  read: 'expense:list',
  manage: 'expense:manage',
};

async function budgetContext(access: Access, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'expense',
    permission: PERMISSIONS[access],
    write: access === 'manage',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getExpenseBudget(financialYear: unknown) {
  const { context, societyId } = await budgetContext('read');
  const parsed = parseModuleInput(
    expenseBudgetFinancialYearSchema,
    financialYear,
  );
  const [budget, settingAccess] = await Promise.all([
    callModuleRpc(
      context,
      'expense_budget_get',
      { p_society_id: societyId, p_financial_year: parsed },
      expenseBudgetSchema,
      'Could not load the budget.',
    ),
    getModuleSettingAccess('expense', context),
  ]);
  return { ...budget, settingsAccess: Object.fromEntries(settingAccess) };
}

export async function getExpenseBudgetCopyPreview(input: unknown) {
  const { context, societyId } = await budgetContext('read');
  const parsed = parseModuleInput(expenseBudgetCopyPreviewInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_copy_preview',
    {
      p_society_id: societyId,
      p_financial_year: parsed.financialYear,
      p_percent_bp: parsed.percent,
    },
    expenseBudgetCopyPreviewSchema,
    'Could not preview last year’s actuals.',
  );
}

export async function saveExpenseBudgetDraft(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await budgetContext('manage', requestId);
  const parsed = parseModuleInput(expenseBudgetDraftInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_save_draft',
    {
      p_society_id: societyId,
      p_financial_year: parsed.financialYear,
      p_lines: parsed.lines.map((line) => ({
        category_id: line.categoryId,
        income_type: line.incomeType,
        phasing: line.phasing,
        annual_paise: line.annualRupees,
        month_paise: line.monthRupees,
      })),
      p_copy_source_year: parsed.copySourceYear,
      p_copy_percent_bp: parsed.copyPercent,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the budget lines, year and version.',
  );
}

export async function discardExpenseBudget(input: unknown, requestId: string) {
  const { context, societyId } = await budgetContext('manage', requestId);
  const parsed = parseModuleInput(expenseBudgetDiscardInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_discard',
    {
      p_society_id: societyId,
      p_budget_id: parsed.budgetId,
      p_reason: parsed.reason,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Only an unchanged draft can be discarded with a reason.',
  );
}

export async function approveExpenseBudget(input: unknown, requestId: string) {
  const { context, societyId } = await budgetContext('manage', requestId);
  const parsed = parseModuleInput(expenseBudgetApproveInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_approve',
    {
      p_society_id: societyId,
      p_budget_id: parsed.budgetId,
      p_approved_body: parsed.approvedBody,
      p_approved_on: parsed.approvedOn,
      p_approval_meeting_id: parsed.approvalMeetingId,
      p_approval_document_id: parsed.approvalDocumentId,
      p_approval_note: parsed.approvalNote,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the approval details and save the current draft first.',
  );
}

export async function recordExpenseBudgetChange(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await budgetContext('manage', requestId);
  const parsed = parseModuleInput(expenseBudgetChangeInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_change_record',
    {
      p_society_id: societyId,
      p_budget_id: parsed.budgetId,
      p_change_kind: parsed.changeKind,
      p_category_id: parsed.categoryId,
      p_income_type: parsed.incomeType,
      p_to_category_id: parsed.toCategoryId,
      p_to_income_type: parsed.toIncomeType,
      p_amount_paise: parsed.amountRupees,
      p_effective_month: parsed.effectiveMonth,
      p_reason: parsed.reason,
      p_approved_body: parsed.approvedBody,
      p_approved_on: parsed.approvedOn,
      p_approval_meeting_id: parsed.approvalMeetingId,
      p_approval_document_id: parsed.approvalDocumentId,
      p_approval_note: parsed.approvalNote,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the change amount, month, approval and current plan.',
  );
}

export async function voidExpenseBudgetChange(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await budgetContext('manage', requestId);
  const parsed = parseModuleInput(expenseBudgetVoidInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_change_void',
    {
      p_society_id: societyId,
      p_change_id: parsed.changeId,
      p_reason: parsed.reason,
      p_expected_version: parsed.expectedVersion,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the cancellation reason and refresh the budget first.',
  );
}

export async function getExpenseBudgetReport(input: unknown) {
  const { context, societyId } = await budgetContext('read');
  const parsed = parseModuleInput(expenseBudgetReportInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_report',
    {
      p_society_id: societyId,
      p_financial_year: parsed.financialYear,
      p_as_of: parsed.asOf,
    },
    expenseBudgetReportSchema,
    'Choose an as-of date inside the financial year.',
  );
}

export async function exportExpenseBudget(input: unknown) {
  const { context, societyId } = await budgetContext('read');
  const parsed = parseModuleInput(expenseBudgetReportInputSchema, input);
  const [report, society] = await Promise.all([
    callModuleRpc(
      context,
      'expense_budget_report',
      {
        p_society_id: societyId,
        p_financial_year: parsed.financialYear,
        p_as_of: parsed.asOf,
      },
      expenseBudgetReportSchema,
      'Choose an as-of date inside the financial year.',
    ),
    context.db.from('societies').select('name').eq('id', societyId).single(),
  ]);
  if (society.error || !society.data)
    throw new Error('Could not load the society name.', {
      cause: society.error,
    });
  return { report, societyName: society.data.name };
}

export async function getResidentBudgetSummary(financialYear: unknown) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'expense',
    permission: 'expense:budget:read',
    write: false,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const parsed = parseModuleInput(
    expenseBudgetFinancialYearSchema,
    financialYear,
  );
  return callModuleRpc(
    context,
    'expense_budget_resident_summary',
    { p_society_id: context.societyId, p_financial_year: parsed },
    expenseBudgetResidentSummarySchema,
    'Could not load the shared budget summary.',
  );
}

export async function saveExpenseBudgetSettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await budgetContext('manage', requestId);
  const parsed = parseModuleInput(expenseBudgetSettingsInputSchema, input);
  return callModuleRpc(
    context,
    'expense_budget_settings_update',
    {
      p_society_id: societyId,
      p_forecast_method: parsed.forecastMethod,
      p_watch_percent: parsed.watchPercent,
      p_resident_summary: parsed.residentSummary,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.object({ updated_at: z.iso.datetime({ offset: true }) }),
    'Choose a valid forecast and resident-sharing setting.',
  );
}
