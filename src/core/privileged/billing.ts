// Run scheduled billing work and receipt email lookups through the service role.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { sendNotificationPushesForRequest } from './notification-delivery';
import { privilegedClient } from './server-client';
import { sendTransactionalEmail } from './transactional-email';

const BILLING_DAILY_RPCS = {
  'billing.late_fees': 'billing_late_fees_run',
  'billing.reminders': 'billing_reminders_run',
  'billing.stale_payments': 'billing_stale_payments_run',
} as const;

export type BillingDailyTask = keyof typeof BILLING_DAILY_RPCS;

export async function runBillingDailyTaskPrivileged(
  task: BillingDailyTask,
  societyId: string,
  today: string,
): Promise<unknown> {
  const requestId = createRequestId();
  const result = await invokeUntypedRpc<unknown>(
    privilegedClient,
    BILLING_DAILY_RPCS[task],
    { p_society_id: societyId, p_today: today, p_request_id: requestId },
  );
  await sendNotificationPushesForRequest(requestId);
  return result;
}

const recipientsSchema = z
  .array(
    z.object({
      email: z.email(),
      name: z.string().nullable(),
    }),
  )
  .max(5);

export type BillingReceiptEmail = {
  societyId: string;
  paymentId: string;
  subject: string;
  textContent: string;
};

export async function sendBillingReceiptEmailPrivileged(
  email: BillingReceiptEmail,
): Promise<number> {
  const recipients = recipientsSchema.parse(
    await invokeUntypedRpc<unknown>(
      privilegedClient,
      'billing_receipt_email_recipients',
      { p_society_id: email.societyId, p_payment_id: email.paymentId },
    ),
  );
  let sent = 0;
  for (const recipient of recipients) {
    const result = await sendTransactionalEmail({
      to: {
        email: recipient.email,
        ...(recipient.name ? { name: recipient.name.slice(0, 120) } : {}),
      },
      subject: email.subject,
      textContent: email.textContent,
    });
    if (result.sent) sent += 1;
  }
  return sent;
}
