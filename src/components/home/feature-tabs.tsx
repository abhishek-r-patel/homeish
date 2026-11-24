// Show one address per P55 tab while preserving every existing route.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUiTranslator } from '@/components/ui/language';

export function FeatureTabs({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  const { translate: t } = useUiTranslator();
  const pathname = usePathname();
  if (items.length <= 1) return null;
  return (
    <nav
      aria-label={t('Feature sections')}
      className="overflow-x-auto border-b border-rule"
    >
      <ul className="flex min-w-max gap-space-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-12 items-center border-b-2 px-space-3 text-body-strong ${active ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
                href={item.href}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
