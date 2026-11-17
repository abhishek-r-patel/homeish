// Let administrators and committee members create an event draft.
import { EventRouteState } from '@/components/event/shared';
import { EventEditor } from '@/components/event/editor';
import { createEventAction } from '@/app/(admin)/admin/events/server-actions';
import { getEventBlockOptions } from '@/core/event/operations';
import { loadEventPage } from '@/core/event/page-access';

export const metadata = {
  title: 'New event | Homeish',
  robots: { index: false, follow: false },
};

export default async function NewEventPage() {
  const result = await loadEventPage(
    ['admin', 'committee'],
    getEventBlockOptions,
  );
  if (result.state) {
    return (
      <EventRouteState
        kind={result.state}
        returnHref="/admin/events"
        retryHref="/admin/events/new"
      />
    );
  }
  return (
    <EventEditor
      detail={null}
      blocks={result.data.blocks}
      billingEnabled={result.data.billingEnabled}
      action={createEventAction}
    />
  );
}
