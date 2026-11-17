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
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
} from '@/core/i18n/format';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Accounts setup | Homeish',
  robots: { index: false, follow: false },
};

export default async function ExpenseSetupPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const formatDate = (value: string) =>
    formatLocalizedDate(
      new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
      locale,
      { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  const w = await getExpenseWorkspace();
  if (!w.can_manage) notFound();
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">{t('Accounts setup')}</h1>
      <ExpenseNav current="setup" canManage locale={locale} />
      <Card title={t('Approval and collections')}>
        <ExpenseSettingsForm
          key={w.settings.updated_at ?? 'new'}
          workspace={w}
        />
      </Card>
      <Card
        title={t('Cash and bank accounts')}
        description={t(
          'Opening balances are fixed once an account has entries.',
        )}
      >
        <div className="grid min-w-0 gap-space-3">
          {w.accounts.map((a) => (
            <details
              key={a.id}
              className="rounded-md border border-rule p-space-3"
            >
              <summary className="cursor-pointer">
                {a.name}
                {a.active ? '' : ` ${t('(inactive)')}`} ·{' '}
                {`${a.balance_paise < 0 ? '-' : ''}${formatLocalizedCurrency(Math.abs(a.balance_paise), locale)}`}{' '}
                · {t('opened')} {formatDate(a.opening_on)}
              </summary>
              <ExpenseAccountForm
                key={a.updated_at}
                account={a}
                today={w.today}
              />
            </details>
          ))}
          <details className="rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">{t('Add account')}</summary>
            <ExpenseAccountForm today={w.today} />
          </details>
        </div>
      </Card>
      <Card title={t('Expense categories')}>
        <div className="grid min-w-0 gap-space-3">
          {w.categories.map((c) => (
            <details
              key={c.id}
              className="rounded-md border border-rule p-space-3"
            >
              <summary className="cursor-pointer">
                {c.name}
                {c.active ? '' : ` ${t('(inactive)')}`}
              </summary>
              <ExpenseCategoryForm key={c.updated_at} category={c} />
            </details>
          ))}
          <details className="rounded-md border border-rule p-space-3">
            <summary className="cursor-pointer">{t('Add category')}</summary>
            <ExpenseCategoryForm />
          </details>
        </div>
      </Card>
    </section>
  );
}
