// Choose the 6-month, 12-month or financial-year period of a P43 report with plain links.
'use client';

import Link from 'next/link';
import { useUiTranslator } from '@/components/ui/language';
import {
  REPORT_PERIODS,
  type ReportPeriod,
} from '@/core/analytics/report-period';

const LABELS: Record<ReportPeriod, string> = {
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  fy: 'This financial year',
};

export function ReportPeriodLinks({
  current,
  hrefs,
}: {
  current: ReportPeriod;
  hrefs: Readonly<Record<ReportPeriod, string>>;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <nav aria-label={t('Report period')}>
      <ul className="flex flex-wrap gap-space-2">
        {REPORT_PERIODS.map((period) => {
          const active = period === current;
          return (
            <li key={period}>
              <Link
                aria-current={active ? 'true' : undefined}
                className={`inline-flex min-h-12 items-center rounded-md border px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'border-brand bg-brand-tint text-brand' : 'border-rule-strong bg-surface text-ink hover:bg-surface-sunken'}`}
                href={hrefs[period]}
              >
                {t(LABELS[period])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
