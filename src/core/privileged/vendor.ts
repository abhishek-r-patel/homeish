// Deliver deduplicated vendor-contract renewal reminders using the service-role job boundary.
import 'server-only';
import { z } from 'zod';
import { createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendNotificationPushesForRequest } from './notification-delivery';

export async function runVendorContractRemindersPrivileged(
  societyId: string,
): Promise<void> {
  const requestId = createRequestId();
  z.number()
    .int()
    .nonnegative()
    .parse(
      await invokeUntypedRpc<unknown>(
        privilegedClient,
        'vendor_contract_reminders_run',
        {
          p_society_id: societyId,
          p_request_trace: requestId,
        },
      ),
    );
  await sendNotificationPushesForRequest(requestId);
}
