// Run bounded inventory reminders and deliver the resulting minimal push notifications.
import 'server-only';
import { z } from 'zod';
import { createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendNotificationPushesForRequest } from './notification-delivery';

export async function runInventoryRemindersPrivileged(
  societyId: string,
): Promise<void> {
  const requestId = createRequestId();
  z.number()
    .int()
    .nonnegative()
    .parse(
      await invokeUntypedRpc<unknown>(
        privilegedClient,
        'housekeeping_low_stock_run',
        { p_society_id: societyId, p_request_trace: requestId },
      ),
    );
  await sendNotificationPushesForRequest(requestId);
}
