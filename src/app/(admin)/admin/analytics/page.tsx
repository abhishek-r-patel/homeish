// Show the live committee analytics dashboard for the active society.
import { AnalyticsDashboardView } from '@/components/analytics/dashboard';
import { AnalyticsRouteState } from '@/components/analytics/shared';
import { getAnalyticsDashboard } from '@/core/analytics/operations';
import { loadAnalyticsPage } from '@/core/analytics/page-access';
import { readAnalyticsRange } from '@/core/analytics/validation';

export const metadata = {
  title: 'Analytics | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const range = readAnalyticsRange(await searchParams);
  const result = await loadAnalyticsPage(() => getAnalyticsDashboard(range));
  if (result.state) {
    return <AnalyticsRouteState kind={result.state} returnHref="/admin" />;
  }
  return (
    <AnalyticsDashboardView
      basePath="/admin/analytics"
      canExport={result.data.canExport}
      canManage={result.data.canManage}
      dashboard={result.data.dashboard}
      settingsHref="/admin/analytics/settings"
    />
  );
}
