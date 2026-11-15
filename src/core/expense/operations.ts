// Authorize P16 expense workflows, verify receipts and shape books for display and export.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { FILE_CONTENT_TYPES, verifyFileAttachment } from '../files/attachments';
import { authorizeRequest } from '../permissions/authorize';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import {
  expenseAccountInputSchema,
  expenseCategoryInputSchema,
  expenseDecisionInputSchema,
  expenseEntriesPageSchema,
  expenseIncomeInputSchema,
  expenseMonthCloseInputSchema,
  expenseMonthReopenInputSchema,
  expensePageSchema,
  expenseRangeSchema,
  expenseRecordInputSchema,
  expenseRecordResultSchema,
  expenseReportSchema,
  expenseReverseInputSchema,
  expenseSettingsInputSchema,
  expenseWorkspaceSchema,
  EXPENSE_STATUSES,
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
  const { data, error } = await context.db
    .from('societies')
    .select('name')
    .eq('id', societyId)
    .single();
  if (error || !data)
    throw new Error('Could not load the society name.', { cause: error });
  return { rows, report, societyName: data.name };
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
