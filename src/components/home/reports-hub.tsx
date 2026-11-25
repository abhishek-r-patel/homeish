// Render the filtered existing report catalogue as linked cards.
'use client';

import Link from 'next/link';
import type { ReportCatalogueItem } from '@/core/home/reports';
import { Card } from '@/components/ui/data-display';
import { useUiTranslator } from '@/components/ui/language';

export function ReportsHub({
  reports,
}: {
  reports: readonly ReportCatalogueItem[];
}) {
  const { translate: t } = useUiTranslator();
  const topics = [...new Set(reports.map((report) => report.topic))];
  if (topics.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        {t('No reports are available for the enabled modules.')}
      </p>
    );
  }
  return (
    <div className="grid gap-space-5">
      {topics.map((topic) => (
        <section className="grid gap-space-3" key={topic}>
          <h2 className="text-heading font-semibold">{t(topic)}</h2>
          <ul className="grid gap-space-3 medium:grid-cols-2">
            {reports
              .filter((report) => report.topic === topic)
              .map((report) => (
                <li key={report.id}>
                  <Card title={t(report.name)}>
                    <p className="text-body text-ink-muted">
                      {t(report.description)}
                    </p>
                    <Link
                      className="mt-space-4 inline-flex min-h-12 items-center text-brand underline"
                      href={report.href}
                    >
                      {t('Open report')}
                    </Link>
                  </Card>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
