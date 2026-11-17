// Run the day-before event reminder job and deliver its push notifications.
import 'server-only';
import { z } from 'zod';
import { createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendNotificationPushesForRequest } from './notification-delivery';

export async function runEventRemindersPrivileged(
  societyId: string,
): Promise<void> {
  const requestId = createRequestId();
  const result = z
    .object({
      events: z.number().int().nonnegative(),
      notified: z.number().int().nonnegative(),
    })
    .parse(
      await invokeUntypedRpc<unknown>(privilegedClient, 'event_reminders_run', {
        p_society_id: societyId,
        p_request_id: requestId,
      }),
    );
  if (result.notified > 0) await sendNotificationPushesForRequest(requestId);
}
