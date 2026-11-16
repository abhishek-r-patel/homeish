// Run automatic request closure and SLA escalation through the service role only.
import 'server-only';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { deliverServiceRequestEscalationEmails } from '../service-requests/escalation';
import { serviceRequestEscalationRunSchema } from '../service-requests/validation';
import { sendNotificationPushesForRequest } from './notification-delivery';
import { privilegedClient } from './server-client';
import { sendTransactionalEmail } from './transactional-email';

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

export async function runServiceRequestEscalationPrivileged(
  societyId: string,
  today: string,
) {
  const requestId = createRequestId();
  const result = serviceRequestEscalationRunSchema.parse(
    await invokeUntypedRpc<unknown>(
      privilegedClient,
      'request_escalation_run',
      {
        p_society_id: societyId,
        p_today: today,
        p_request_trace: requestId,
      },
    ),
  );
  await sendNotificationPushesForRequest(requestId);
  const email = await deliverServiceRequestEscalationEmails(
    result.emails,
    sendTransactionalEmail,
  );
  if (email.failed > 0 || email.skipped > 0) {
    console.warn('service_request.escalation_email_incomplete', {
      requestId,
      ...email,
    });
  }
  return { admin: result.admin, committee: result.committee, email };
}
