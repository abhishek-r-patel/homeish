// Show event details, totals, RSVPs and the publish, cancel and delete actions.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { EventRouteState } from '@/components/event/shared';
import {
  EventAdminDetailView,
  type EventAdminActions,
} from '@/components/event/admin';
import {
  cancelEventAction,
  deleteEventDraftAction,
  publishEventAction,
} from '@/app/(admin)/admin/events/server-actions';
import {
  getEventAdminDetail,
  getEventBlockOptions,
} from '@/core/event/operations';
import { loadEventPage } from '@/core/event/page-access';

export const metadata = {
  title: 'Event details | Homeish',
  robots: { index: false, follow: false },
};

const actions: EventAdminActions = {
  publish: publishEventAction,
  cancel: cancelEventAction,
  deleteDraft: deleteEventDraftAction,
};

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!z.uuid().safeParse(eventId).success) notFound();
  const result = await loadEventPage(['admin', 'committee'], async () => {
    const detail = await getEventAdminDetail(eventId);
    // Block names are only needed to label a block-scoped audience.
    const blocks =
      detail.event.audience.scope === 'blocks'
        ? (await getEventBlockOptions()).blocks
        : [];
    return { detail, blocks };
  });
  if (result.state) {
    return (
      <EventRouteState
        kind={result.state}
        returnHref="/admin/events"
        retryHref={`/admin/events/${eventId}`}
      />
    );
  }
  return (
    <EventAdminDetailView
      detail={result.data.detail}
      blocks={result.data.blocks}
      actions={actions}
    />
  );
}
