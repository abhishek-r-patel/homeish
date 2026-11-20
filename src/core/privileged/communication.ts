// Post scheduled notices that are due and deliver their push notifications.
import 'server-only';
import { z } from 'zod';
import { createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendNotificationPushesForRequest } from './notification-delivery';

export async function runNoticeScheduledPublishPrivileged(
  societyId: string,
  today: string,
): Promise<void> {
  const requestId = createRequestId();
  const published = z
    .number()
    .int()
    .nonnegative()
    .parse(
      await invokeUntypedRpc<unknown>(
        privilegedClient,
        'notice_scheduled_publish_run',
        {
          p_society_id: societyId,
          p_today: today,
          p_request_trace: requestId,
        },
      ),
    );
  if (published > 0) await sendNotificationPushesForRequest(requestId);
}
