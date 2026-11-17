// Show an event open to the resident's home with spots left and a per-home RSVP form.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { EventRouteState } from '@/components/event/shared';
import { ResidentEventDetailView } from '@/components/event/resident';
import { setEventRsvpAction } from '@/app/(resident)/events/server-actions';
import { getEventMemberDetail } from '@/core/event/operations';
import { loadEventPage } from '@/core/event/page-access';

export const metadata = {
  title: 'Event | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!z.uuid().safeParse(eventId).success) notFound();
  const result = await loadEventPage(['resident'], () =>
    getEventMemberDetail(eventId),
  );
  if (result.state) {
    return (
      <EventRouteState
        kind={result.state}
        returnHref="/events"
        retryHref={`/events/${eventId}`}
      />
    );
  }
  return (
    <ResidentEventDetailView
      detail={result.data}
      rsvpAction={setEventRsvpAction}
    />
  );
}
