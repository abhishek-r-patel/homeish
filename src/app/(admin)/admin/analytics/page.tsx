// Show the live committee analytics dashboard for the active society.
import { AnalyticsDashboardView } from '@/components/analytics/dashboard';
import { AnalyticsRouteState } from '@/components/analytics/shared';
import { MeetingSummaryHeadline } from '@/components/meeting/summary';
import { getAnalyticsDashboard } from '@/core/analytics/operations';
import { loadAnalyticsPage } from '@/core/analytics/page-access';
import { readAnalyticsRange } from '@/core/analytics/validation';
import { AppError } from '@/core/errors';
import { getMeetingGovernanceSummary } from '@/core/meeting/summary-operations';

export const metadata = {
  title: 'Analytics | Homeish',
  robots: { index: false, follow: false },
};

// The meeting headline is optional: it is left out when the meeting module is off or the viewer cannot read it.
async function loadMeetingHeadline() {
  try {
    return await getMeetingGovernanceSummary('12m');
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'FORBIDDEN' || error.code === 'MODULE_DISABLED')
    ) {
      return null;
    }
    throw error;
  }
}

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
  const meeting = await loadMeetingHeadline();
  return (
    <AnalyticsDashboardView
      basePath="/admin/analytics"
      canExport={result.data.canExport}
      canManage={result.data.canManage}
      dashboard={result.data.dashboard}
      headlines={
        meeting ? <MeetingSummaryHeadline summary={meeting} /> : undefined
      }
      settingsHref="/admin/analytics/settings"
    />
  );
}
