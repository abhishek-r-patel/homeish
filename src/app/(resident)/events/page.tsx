// Show the resident's upcoming or past events with each home's RSVP state.
import { EventRouteState } from '@/components/event/shared';
import { ResidentEventListView } from '@/components/event/resident';
import { getEventMemberList } from '@/core/event/operations';
import { loadEventPage } from '@/core/event/page-access';
import { eventMemberFilterSchema } from '@/core/event/validation';

export const metadata = {
  title: 'Events | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const filter = eventMemberFilterSchema.parse(
    typeof view === 'string' ? view : null,
  );
  const result = await loadEventPage(['resident'], () =>
    getEventMemberList(filter),
  );
  if (result.state) {
    return (
      <EventRouteState
        kind={result.state}
        returnHref="/home"
        retryHref="/events"
      />
    );
  }
  return <ResidentEventListView list={result.data} filter={filter} />;
}
