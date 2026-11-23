// Show the P50.6 role-limited major-works summary without consent detail.
import { MajorWorksSummaryView } from '@/components/major-works/summary-view';
import { getMajorWorksSummary } from '@/core/major-works/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';

export const metadata = {
  title: 'Major works summary | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksSummaryPage() {
  const [locale, summary] = await Promise.all([
    getRequestLocale(),
    getMajorWorksSummary(),
  ]);
  return <MajorWorksSummaryView locale={locale} summary={summary} />;
}
