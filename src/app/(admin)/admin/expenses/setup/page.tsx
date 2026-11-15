// Let administrators manage accounts, categories and approval settings.
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/data-display';
import {
  ExpenseAccountForm,
  ExpenseCategoryForm,
  ExpenseSettingsForm,
} from '@/components/expense/controls';
import { ExpenseNav } from '@/components/expense/nav';
import { getExpenseWorkspace } from '@/core/expense/operations';
import { formatSignedRupees } from '@/core/expense/documents';
import { formatBillingDate } from '@/core/billing/format';

export const metadata = {
  title: 'Accounts setup | Homeish',
  robots: { index: false, follow: false },
};

export default async function ExpenseSetupPage() {
  const w = await getExpenseWorkspace();
  if (!w.can_manage) notFound();
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">Accounts setup</h1>
      <ExpenseNav current="setup" canManage />
      <Card title="Approval and collections">
        <ExpenseSettingsForm
          key={w.settings.updated_at ?? 'new'}
          workspace={w}
        />
      </Card>
      <Card
        title="Cash and bank accounts"
        description="Opening balances are fixed once an account has entries."
      >
        <div className="grid min-w-0 gap-space-3">
          {w.accounts.map((a) => (
            <details
              key={a.id}
              className="rounded-md border border-rule p-space-3"
            >
              <summary className="cursor-pointer">
                {a.name}
                {a.active ? '' : ' (inactive)'} ·{' '}
                {formatSignedRupees(a.balance_paise)} · opened{' '}
                {formatBillingDate(a.opening_on)}
              </summary>
              <ExpenseAccountForm
                key={a.updated_at}
                account={a}
                today={w.today}
              />
            </details>
          ))}
          <details className="rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">Add account</summary>
            <ExpenseAccountForm today={w.today} />
          </details>
        </div>
      </Card>
      <Card title="Expense categories">
        <div className="grid min-w-0 gap-space-3">
          {w.categories.map((c) => (
            <details
              key={c.id}
              className="rounded-md border border-rule p-space-3"
            >
              <summary className="cursor-pointer">
                {c.name}
                {c.active ? '' : ' (inactive)'}
              </summary>
              <ExpenseCategoryForm key={c.updated_at} category={c} />
            </details>
          ))}
          <details className="rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">Add category</summary>
            <ExpenseCategoryForm />
          </details>
        </div>
      </Card>
    </section>
  );
}
