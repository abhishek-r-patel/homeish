// Run automatic request closure through the service role only.
import 'server-only';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { sendNotificationPushesForRequest } from './notification-delivery';
import { privilegedClient } from './server-client';

export async function runServiceRequestAutoClosePrivileged(
  societyId: string,
  today: string,
): Promise<number> {
  const requestId = createRequestId();
  const result = await invokeUntypedRpc<number>(
    privilegedClient,
    'request_auto_close_run',
    {
      p_society_id: societyId,
      p_today: today,
      p_request_trace: requestId,
    },
  );
  await sendNotificationPushesForRequest(requestId);
  return result;
}
