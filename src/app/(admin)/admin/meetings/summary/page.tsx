// Show the P43.5 meeting and committee summary to administrators and committee members.
import { MeetingRouteState } from '@/components/meeting/shared';
import { MeetingSummaryView } from '@/components/meeting/summary';
import { readReportPeriod } from '@/core/analytics/report-period';
import { loadMeetingPage } from '@/core/meeting/page-access';
import { getMeetingGovernanceSummary } from '@/core/meeting/summary-operations';

export const metadata = {
  title: 'Meeting summary | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminMeetingSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = readReportPeriod((await searchParams).period);
  const result = await loadMeetingPage(['admin', 'committee'], () =>
    getMeetingGovernanceSummary(period),
  );
  if (result.state) {
    return (
      <MeetingRouteState
        kind={result.state}
        returnHref="/admin/meetings"
        retryHref={`/admin/meetings/summary?period=${period}`}
      />
    );
  }
  return <MeetingSummaryView summary={result.data} />;
}
