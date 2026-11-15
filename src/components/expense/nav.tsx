// Link between accounts views and page through long lists.
import Link from 'next/link';

const VIEWS = [
  { key: 'book', href: '/admin/expenses', label: 'Books', manageOnly: false },
  {
    key: 'reports',
    href: '/admin/expenses/reports',
    label: 'Reports',
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
}: {
  current: (typeof VIEWS)[number]['key'];
  canManage: boolean;
}) {
  return (
    <nav aria-label="Accounts" className="flex flex-wrap gap-space-4">
      {VIEWS.filter((view) => canManage || !view.manageOnly).map((view) =>
        view.key === current ? (
          <span key={view.key} aria-current="page" className="font-semibold">
            {view.label}
          </span>
        ) : (
          <Link
            key={view.key}
            href={view.href}
            className="text-brand underline"
          >
            {view.label}
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
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={label}
      className="mt-space-3 flex flex-wrap items-center gap-space-4"
    >
      {page > 1 ? (
        <Link className="text-brand underline" href={href(page - 1)}>
          Previous
        </Link>
      ) : null}
      <span>
        Page {Math.min(page, pages)} of {pages}
      </span>
      {page < pages ? (
        <Link className="text-brand underline" href={href(page + 1)}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
