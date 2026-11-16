// Let administrators choose which analytics the committee dashboard shows.
import { AnalyticsSettingsView } from '@/components/analytics/settings';
import { AnalyticsRouteState } from '@/components/analytics/shared';
import { updateAnalyticsSettingsAction } from '@/app/(admin)/admin/analytics/actions';
import { getAnalyticsSettings } from '@/core/analytics/operations';
import { loadAnalyticsPage } from '@/core/analytics/page-access';

export const metadata = {
  title: 'Analytics settings | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsSettingsPage() {
  const result = await loadAnalyticsPage(getAnalyticsSettings);
  if (result.state) {
    return (
      <AnalyticsRouteState
        deniedMessage="Only society administrators can change analytics settings."
        kind={result.state}
        returnHref="/admin/analytics"
        returnLabel="Back to analytics"
      />
    );
  }
  return (
    <AnalyticsSettingsView
      action={updateAnalyticsSettingsAction}
      dashboardHref="/admin/analytics"
      settings={result.data}
    />
  );
}
