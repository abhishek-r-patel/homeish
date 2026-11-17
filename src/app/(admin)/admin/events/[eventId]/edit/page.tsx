// Let administrators and committee members edit a draft or upcoming published event.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { EventRouteState } from '@/components/event/shared';
import { EventEditor } from '@/components/event/editor';
import { updateEventAction } from '@/app/(admin)/admin/events/server-actions';
import {
  getEventAdminDetail,
  getEventBlockOptions,
} from '@/core/event/operations';
import { loadEventPage } from '@/core/event/page-access';

export const metadata = {
  title: 'Edit event | Homeish',
  robots: { index: false, follow: false },
};

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!z.uuid().safeParse(eventId).success) notFound();
  const result = await loadEventPage(['admin', 'committee'], async () => {
    const [detail, options] = await Promise.all([
      getEventAdminDetail(eventId),
      getEventBlockOptions(),
    ]);
    return { detail, blocks: options.blocks };
  });
  if (result.state) {
    return (
      <EventRouteState
        kind={result.state}
        returnHref={`/admin/events/${eventId}`}
        retryHref={`/admin/events/${eventId}/edit`}
      />
    );
  }
  return (
    <EventEditor
      detail={result.data.detail}
      blocks={result.data.blocks}
      billingEnabled={result.data.detail.billingEnabled}
      action={updateEventAction}
    />
  );
}
