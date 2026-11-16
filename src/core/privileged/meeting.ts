// Run the bounded overdue action-item reminder job and deliver its push notifications.
import 'server-only';
import { z } from 'zod';
import { createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendNotificationPushesForRequest } from './notification-delivery';

export async function runMeetingActionRemindersPrivileged(
  societyId: string,
): Promise<void> {
  const requestId = createRequestId();
  z.object({ notified: z.number().int().nonnegative() }).parse(
    await invokeUntypedRpc<unknown>(
      privilegedClient,
      'meeting_action_reminders_run',
      { p_society_id: societyId, p_request_id: requestId },
    ),
  );
  await sendNotificationPushesForRequest(requestId);
}
