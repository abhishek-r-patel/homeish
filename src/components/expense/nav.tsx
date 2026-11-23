// Link between accounts views and page through long lists.
import Link from 'next/link';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';

const VIEWS = [
  { key: 'book', href: '/admin/expenses', label: 'Books', manageOnly: false },
  {
    key: 'reports',
    href: '/admin/expenses/reports',
    label: 'Reports',
    manageOnly: false,
  },
  {
    key: 'vendor-spend',
    href: '/admin/expenses/vendor-spend',
    label: 'Vendor spend',
    manageOnly: false,
  },
  {
    key: 'savings',
    href: '/admin/expenses/savings',
    label: 'Savings',
    manageOnly: false,
  },
  {
    key: 'statements',
    href: '/admin/expenses/statements',
    label: 'Statements',
    manageOnly: false,
  },
  {
    key: 'audit',
    href: '/admin/expenses/audit',
    label: 'Audit tracker',
    manageOnly: false,
  },
  {
    key: 'agm-report',
    href: '/admin/expenses/agm-report',
    label: 'AGM draft',
    manageOnly: false,
  },
  {
    key: 'reconciliation',
    href: '/admin/expenses/reconciliation',
    label: 'Reconciliation',
    manageOnly: false,
  },
  {
    key: 'petty-cash',
    href: '/petty-cash',
    label: 'Petty cash',
    manageOnly: false,
  },
  {
    key: 'funds',
    href: '/admin/expenses/funds',
    label: 'Funds',
    manageOnly: false,
  },
  {
    key: 'setup',
    href: '/admin/expenses/setup',
    label: 'Setup',
    manageOnly: true,
  },
] as const;

export function ExpenseNav({
  current,
  canManage,
  locale = 'en',
}: {
  current: (typeof VIEWS)[number]['key'];
  canManage: boolean;
  locale?: Locale;
}) {
  const t = (source: string) => translateMessage(locale, source);
  return (
    <nav aria-label={t('Accounts')} className="flex flex-wrap gap-space-4">
      {VIEWS.filter((view) => canManage || !view.manageOnly).map((view) =>
        view.key === current ? (
          <span key={view.key} aria-current="page" className="font-semibold">
            {t(view.label)}
          </span>
        ) : (
          <Link
            key={view.key}
            href={view.href}
            className="text-brand underline"
          >
            {t(view.label)}
          </Link>
        ),
      )}
    </nav>
  );
}

export function ExpensePager({
  page,
  total,
  pageSize,
  href,
  label,
  locale = 'en',
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
  label: string;
  locale?: Locale;
}) {
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={label}
      className="mt-space-3 flex flex-wrap items-center gap-space-4"
    >
      {page > 1 ? (
        <Link className="text-brand underline" href={href(page - 1)}>
          {t('Previous')}
        </Link>
      ) : null}
      <span>
        {t('Page {page} of {total}', {
          page: Math.min(page, pages),
          total: pages,
        })}
      </span>
      {page < pages ? (
        <Link className="text-brand underline" href={href(page + 1)}>
          {t('Next')}
        </Link>
      ) : null}
    </nav>
  );
}
