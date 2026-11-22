// Let administrators manage accounts, categories, approval settings and petty cash.
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/data-display';
import {
  ExpenseAccountForm,
  ExpenseCategoryForm,
  ExpenseSettingsForm,
} from '@/components/expense/controls';
import { ExpenseAgmSettingsForm } from '@/components/expense/agm';
import { PettyCashAssignForm } from '@/components/expense/reconciliation-controls';
import { ExpenseNav } from '@/components/expense/nav';
import {
  getExpenseAgmDraft,
  getExpenseWorkspace,
  getPettyCash,
} from '@/core/expense/operations';
import { expenseFinancialYearStart } from '@/core/expense/validation';
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
  const [petty, agm] = await Promise.all([
    getPettyCash(),
    getExpenseAgmDraft(expenseFinancialYearStart(w.today)),
  ]);
  const pettyAccount = petty.account ?? petty.cash_account;
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
        title={t('AGM report sections')}
        description={t(
          'All sections are on by default. Disabled sections stay out of the draft and PDF.',
        )}
      >
        <ExpenseAgmSettingsForm
          key={agm.settings_updated_at}
          sections={agm.sections}
          updatedAt={agm.settings_updated_at}
        />
      </Card>
      <Card
        title={t('Cash, bank and deposit accounts')}
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
      <Card
        title={t('Petty cash')}
        description={t(
          'The custodian can open the petty cash page and record counts. Changing the custodian needs a handover count.',
        )}
      >
        {pettyAccount ? (
          <>
            <p>
              {pettyAccount.name} · {t('Custodian')}:{' '}
              {petty.custodian?.full_name ?? t('Not named')}
            </p>
            <PettyCashAssignForm
              key={petty.custodian?.user_id ?? 'none'}
              accountId={pettyAccount.id}
              members={petty.members}
              currentCustodianId={petty.custodian?.user_id ?? null}
            />
          </>
        ) : (
          <p>{t('Add an active cash account first.')}</p>
        )}
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
