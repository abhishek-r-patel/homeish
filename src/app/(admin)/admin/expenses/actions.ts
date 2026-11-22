// Run authorized expense, funds, audit, AGM and month-close mutations.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  assignPettyCash,
  activateExpenseFunds,
  acknowledgeExpenseAuditWarning,
  cancelStatementItem,
  closeExpenseMonth,
  correctExpenseFundAllocation,
  correctExpenseFundOpening,
  confirmExpenseFundAllocations,
  decideExpense,
  matchStatementItem,
  recordCashCount,
  recordExpense,
  recordIncome,
  recordExpenseTransfer,
  saveExpenseFixedDeposit,
  saveExpenseFundInterest,
  saveExpenseFundTransferRule,
  recordExpenseFundTransfer,
  reverseExpenseFundTransfer,
  saveExpenseFundCorpus,
  linkExpenseFundReceipt,
  saveExpenseFundWork,
  linkExpenseFundWork,
  recordStatementItem,
  reopenExpenseMonth,
  reverseExpenseEntry,
  reverseExpenseTransfer,
  saveExpenseAccount,
  saveExpenseCategory,
  saveExpenseFund,
  saveExpenseFundMapping,
  saveExpenseSettings,
  saveExpenseAuditObjection,
  saveExpenseAuditQuery,
  saveExpenseAuditYear,
  saveExpenseAgmDraft,
  saveExpenseAgmSettings,
} from '@/core/expense/operations';

function input(form: FormData): unknown {
  const raw = form.get('input');
  if (typeof raw !== 'string')
    throw new ValidationError({ form: 'Missing account details.' });
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError({ form: 'Invalid account details.' });
  }
}

export async function recordExpenseAction(form: FormData) {
  return runServerAction('/admin/expenses', async (id) => {
    const result = await recordExpense(input(form), id);
    return result.status === 'posted'
      ? 'Expense posted to the books.'
      : 'Expense sent for committee approval.';
  });
}
export async function decideExpenseAction(form: FormData) {
  return runServerAction('/admin/expenses', async (id) => {
    const result = await decideExpense(input(form), id);
    return result.status === 'posted'
      ? 'Expense approved and posted.'
      : 'Expense rejected.';
  });
}
export async function recordIncomeAction(form: FormData) {
  return runServerAction('/admin/expenses', async (id) => {
    await recordIncome(input(form), id);
    return 'Income recorded.';
  });
}
export async function reverseEntryAction(form: FormData) {
  return runServerAction('/admin/expenses', async (id) => {
    await reverseExpenseEntry(input(form), id);
    return 'Reversal recorded.';
  });
}
export async function recordTransferAction(form: FormData) {
  return runServerAction('/admin/expenses', async (id) => {
    await recordExpenseTransfer(input(form), id);
    return 'Transfer recorded between the two accounts.';
  });
}
export async function reverseTransferAction(form: FormData) {
  return runServerAction('/admin/expenses', async (id) => {
    await reverseExpenseTransfer(input(form), id);
    return 'Both transfer entries reversed.';
  });
}
export async function saveExpenseFixedDepositAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFixedDeposit(input(form), id);
    return 'Fixed deposit saved.';
  });
}
export async function saveExpenseFundInterestAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFundInterest(input(form), id);
    return 'Interest and TDS record saved.';
  });
}
export async function saveExpenseFundTransferRuleAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFundTransferRule(input(form), id);
    return 'Fund transfer pair saved.';
  });
}
export async function recordExpenseFundTransferAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await recordExpenseFundTransfer(input(form), id);
    return 'Fund allocation transfer recorded.';
  });
}
export async function reverseExpenseFundTransferAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await reverseExpenseFundTransfer(input(form), id);
    return 'Fund allocation transfer reversed.';
  });
}
export async function saveExpenseFundCorpusAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFundCorpus(input(form), id);
    return 'Corpus record saved. This is not a bill or legal debt.';
  });
}
export async function linkExpenseFundReceiptAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await linkExpenseFundReceipt(input(form), id);
    return 'Receipt linked to the corpus record.';
  });
}
export async function saveExpenseFundWorkAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFundWork(input(form), id);
    return 'Sanctioned work saved.';
  });
}
export async function linkExpenseFundWorkAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await linkExpenseFundWork(input(form), id);
    return 'Accounts expense linked to sanctioned work.';
  });
}
export async function saveExpenseAccountAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await saveExpenseAccount(input(form), id);
    return 'Account saved.';
  });
}
export async function saveExpenseCategoryAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await saveExpenseCategory(input(form), id);
    return 'Category saved.';
  });
}
export async function saveExpenseFundAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFund(input(form), id);
    return 'Fund saved.';
  });
}
export async function activateExpenseFundsAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await activateExpenseFunds(input(form), id);
    return 'Fund tracking activated.';
  });
}
export async function saveExpenseFundMappingAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await saveExpenseFundMapping(input(form), id);
    return 'Fund suggestion saved.';
  });
}
export async function confirmExpenseFundAllocationsAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    const result = await confirmExpenseFundAllocations(input(form), id);
    return result.skipped.length
      ? `Confirmed ${result.confirmed_count} allocations. ${result.skipped.length} closed-month entries were skipped.`
      : `Confirmed ${result.confirmed_count} allocations.`;
  });
}
export async function correctExpenseFundOpeningAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await correctExpenseFundOpening(input(form), id);
    return 'Fund opening corrected and re-confirmed.';
  });
}
export async function correctExpenseFundAllocationAction(form: FormData) {
  return runServerAction('/admin/expenses/funds', async (id) => {
    await correctExpenseFundAllocation(input(form), id);
    return 'Fund allocation corrected.';
  });
}
export async function saveExpenseSettingsAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await saveExpenseSettings(input(form), id);
    return 'Account settings saved.';
  });
}
export async function acknowledgeExpenseAuditWarningAction(form: FormData) {
  return runServerAction('/admin/expenses/audit', async (id) => {
    await acknowledgeExpenseAuditWarning(input(form), id);
    return 'Audit and AGM warning acknowledged.';
  });
}
export async function saveExpenseAuditYearAction(form: FormData) {
  return runServerAction('/admin/expenses/audit', async (id) => {
    await saveExpenseAuditYear(input(form), id);
    return 'Audit year saved.';
  });
}
export async function saveExpenseAuditQueryAction(form: FormData) {
  return runServerAction('/admin/expenses/audit', async (id) => {
    await saveExpenseAuditQuery(input(form), id);
    return 'Audit query saved.';
  });
}
export async function saveExpenseAuditObjectionAction(form: FormData) {
  return runServerAction('/admin/expenses/audit', async (id) => {
    await saveExpenseAuditObjection(input(form), id);
    return 'Audit objection saved.';
  });
}
export async function saveExpenseAgmDraftAction(form: FormData) {
  return runServerAction('/admin/expenses/agm-report', async (id) => {
    await saveExpenseAgmDraft(input(form), id);
    return 'AGM draft saved.';
  });
}
export async function saveExpenseAgmSettingsAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await saveExpenseAgmSettings(input(form), id);
    return 'AGM report sections saved.';
  });
}
export async function closeExpenseMonthAction(form: FormData) {
  return runServerAction('/admin/expenses/reports', async (id) => {
    await closeExpenseMonth(input(form), id);
    return 'Month closed.';
  });
}
export async function reopenExpenseMonthAction(form: FormData) {
  return runServerAction('/admin/expenses/reports', async (id) => {
    await reopenExpenseMonth(input(form), id);
    return 'Month reopened.';
  });
}
export async function recordStatementItemAction(form: FormData) {
  return runServerAction('/admin/expenses/reconciliation', async (id) => {
    await recordStatementItem(input(form), id);
    return 'Statement item added.';
  });
}
export async function matchStatementItemAction(form: FormData) {
  return runServerAction('/admin/expenses/reconciliation', async (id) => {
    await matchStatementItem(input(form), id);
    return 'Statement item matched.';
  });
}
export async function cancelStatementItemAction(form: FormData) {
  return runServerAction('/admin/expenses/reconciliation', async (id) => {
    await cancelStatementItem(input(form), id);
    return 'Statement item cancelled.';
  });
}
export async function assignPettyCashAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await assignPettyCash(input(form), id);
    return 'Petty cash custodian saved.';
  });
}
export async function recordCashCountAction(form: FormData) {
  return runServerAction('/petty-cash', async (id) => {
    await recordCashCount(input(form), id);
    return 'Cash count recorded.';
  });
}
