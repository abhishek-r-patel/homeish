// Run authorized expense, income, approval, setup and month-close mutations.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  closeExpenseMonth,
  decideExpense,
  recordExpense,
  recordIncome,
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
