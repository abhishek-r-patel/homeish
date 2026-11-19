// Run authorized expense, income, approval, setup, reconciliation, petty-cash and month-close mutations.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  assignPettyCash,
  cancelStatementItem,
  closeExpenseMonth,
  decideExpense,
  matchStatementItem,
  recordCashCount,
  recordExpense,
  recordIncome,
  recordStatementItem,
  reopenExpenseMonth,
  reverseExpenseEntry,
  saveExpenseAccount,
  saveExpenseCategory,
  saveExpenseSettings,
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
export async function saveExpenseSettingsAction(form: FormData) {
  return runServerAction('/admin/expenses/setup', async (id) => {
    await saveExpenseSettings(input(form), id);
    return 'Account settings saved.';
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
