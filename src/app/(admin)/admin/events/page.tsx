// Show the administrator and committee events workspace with a status filter.
import { EventRouteState } from '@/components/event/shared';
import { EventAdminListView } from '@/components/event/admin';
import { getEventAdminList } from '@/core/event/operations';
import { loadEventPage } from '@/core/event/page-access';
import { eventAdminFilterSchema } from '@/core/event/validation';

export const metadata = {
  title: 'Events | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter = eventAdminFilterSchema.parse(
    typeof rawFilter === 'string' ? rawFilter : null,
  );
  const result = await loadEventPage(['admin', 'committee'], () =>
    getEventAdminList(filter),
  );
  if (result.state) {
    return (
      <EventRouteState
        kind={result.state}
        returnHref="/admin"
        retryHref="/admin/events"
      />
    );
  }
  return <EventAdminListView workspace={result.data} filter={filter} />;
}
