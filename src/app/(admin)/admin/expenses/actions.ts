// Run authorized expense, funds, audit, AGM and month-close mutations.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  approveExpenseBudget,
  discardExpenseBudget,
  recordExpenseBudgetChange,
  saveExpenseBudgetDraft,
  saveExpenseBudgetSettings,
  voidExpenseBudgetChange,
} from '@/core/expense/budget-operations';
import {
  assignPettyCash,
  activateExpenseFunds,
  acknowledgeExpenseAuditWarning,
  addExpenseSavingsEvidence,
  cancelStatementItem,
  changeExpenseSavingsStatus,
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
  removeExpensePayeeMapping,
  reverseExpenseEntry,
  reverseExpenseTransfer,
  saveExpenseAccount,
  saveExpenseCategory,
  saveExpenseCategoryDetails,
  saveExpenseFund,
  saveExpenseFundMapping,
  saveExpenseSettings,
  saveExpensePayeeMapping,
  saveExpenseSavings,
  saveExpenseAuditObjection,
  saveExpenseAuditQuery,
  saveExpenseAuditYear,
  saveExpenseAgmDraft,
  saveExpenseAgmSettings,
  voidExpenseSavingsEvidence,
} from '@/core/expense/operations';
import {
  archiveExpenseRepairForecastItem,
  saveExpenseRepairForecastItem,
  setExpenseRepairForecastFund,
} from '@/core/expense/repair-forecast-operations';

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
export async function saveExpenseCategoryDetailsAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await saveExpenseCategoryDetails(input(form), id);
    return 'Category details saved.';
  });
}
export async function saveExpensePayeeMappingAction(form: FormData) {
  return runServerAction('/admin/expenses/vendor-spend', async (id) => {
    await saveExpensePayeeMapping(input(form), id);
    return 'Payee mapped to vendor.';
  });
}
export async function removeExpensePayeeMappingAction(form: FormData) {
  return runServerAction('/admin/expenses/vendor-spend', async (id) => {
    await removeExpensePayeeMapping(input(form), id);
    return 'Payee mapping removed. Its history is kept.';
  });
}
export async function saveExpenseSavingsAction(form: FormData) {
  return runServerAction('/admin/expenses/savings', async (id) => {
    await saveExpenseSavings(input(form), id);
    return 'Savings initiative saved.';
  });
}
export async function saveExpenseBudgetDraftAction(form: FormData) {
  return runServerAction('/admin/expenses/budget', async (id) => {
    await saveExpenseBudgetDraft(input(form), id);
    return 'Budget draft saved.';
  });
}
export async function approveExpenseBudgetAction(form: FormData) {
  return runServerAction('/admin/expenses/budget', async (id) => {
    await approveExpenseBudget(input(form), id);
    return 'Budget approved. Its figures are now locked.';
  });
}
export async function discardExpenseBudgetAction(form: FormData) {
  return runServerAction('/admin/expenses/budget', async (id) => {
    await discardExpenseBudget(input(form), id);
    return 'Budget draft discarded. Its record is kept.';
  });
}
export async function recordExpenseBudgetChangeAction(form: FormData) {
  return runServerAction('/admin/expenses/budget', async (id) => {
    await recordExpenseBudgetChange(input(form), id);
    return 'Budget change recorded.';
  });
}
export async function saveExpenseBudgetSettingsAction(form: FormData) {
  return runServerAction('/admin/expenses/budget', async (id) => {
    await saveExpenseBudgetSettings(input(form), id);
    return 'Budget settings saved.';
  });
}
export async function voidExpenseBudgetChangeAction(form: FormData) {
  return runServerAction('/admin/expenses/budget', async (id) => {
    await voidExpenseBudgetChange(input(form), id);
    return 'Budget change cancelled. Its history is kept.';
  });
}
export async function saveExpenseRepairForecastItemAction(form: FormData) {
  return runServerAction('/admin/expenses/funds/forecast', async (id) => {
    await saveExpenseRepairForecastItem(input(form), id);
    return 'Repair forecast item saved.';
  });
}
export async function archiveExpenseRepairForecastItemAction(form: FormData) {
  return runServerAction('/admin/expenses/funds/forecast', async (id) => {
    await archiveExpenseRepairForecastItem(input(form), id);
    return 'Repair forecast item updated. Its history is kept.';
  });
}
export async function setExpenseRepairForecastFundAction(form: FormData) {
  return runServerAction('/admin/expenses/funds/forecast', async (id) => {
    await setExpenseRepairForecastFund(input(form), id);
    return 'Forecast gap fund updated.';
  });
}
export async function changeExpenseSavingsStatusAction(form: FormData) {
  return runServerAction('/admin/expenses/savings', async (id) => {
    await changeExpenseSavingsStatus(input(form), id);
    return 'Savings status changed.';
  });
}
export async function addExpenseSavingsEvidenceAction(form: FormData) {
  return runServerAction('/admin/expenses/savings', async (id) => {
    await addExpenseSavingsEvidence(input(form), id);
    return 'Savings evidence added.';
  });
}
export async function voidExpenseSavingsEvidenceAction(form: FormData) {
  return runServerAction('/admin/expenses/savings', async (id) => {
    await voidExpenseSavingsEvidence(input(form), id);
    return 'Savings evidence voided. Its history is kept.';
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
