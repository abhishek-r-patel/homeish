// Render and send queued bill emails through the service-role boundary.
import 'server-only';
import { z } from 'zod';
import { publicEnvironment } from '../config/public-env';
import {
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '../billing/format';
import { renderBillPdf } from '../billing/documents';
import { billingBillDetailsSchema } from '../billing/validation';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendTransactionalEmail } from './transactional-email';

const payloadSchema = z.object({
  bill: billingBillDetailsSchema,
  recipients: z
    .array(
      z.object({
        email: z.email(),
        name: z.string().nullable(),
      }),
    )
    .max(100),
});

const queueItemSchema = z.object({
  bill_id: z.uuid(),
});

function billUrl(billId: string) {
  const url = new URL('/login', publicEnvironment.NEXT_PUBLIC_APP_URL);
  url.searchParams.set('next', `/bills/${billId}`);
  return url.toString();
}

function fileName(unitNumber: string, period: string) {
  const safeUnit = unitNumber.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `bill-${safeUnit}-${period}.pdf`;
}

async function renderWithRetry(bill: z.infer<typeof billingBillDetailsSchema>) {
  try {
    return await renderBillPdf(bill);
  } catch (error) {
    const retry = await renderBillPdf(bill).catch(() => undefined);
    if (retry) return retry;
    throw error;
  }
}

export async function runBillingEmailJobsPrivileged(
  societyId: string,
): Promise<void> {
  const { data: jobs, error } = await privilegedClient
    .from('jobs')
    .select('id,summary')
    .eq('society_id', societyId)
    .eq('type', 'bill_email')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(25);
  if (error)
    throw new Error('Could not load queued bill emails.', { cause: error });

  for (const job of jobs ?? []) {
    const { data: claimed } = await privilegedClient
      .from('jobs')
      .update({ status: 'running', progress: 0, finished_at: null })
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
      const item = queueItemSchema.parse(job.summary);
      const payload = payloadSchema.parse(
        await invokeUntypedRpc<unknown>(
          privilegedClient,
          'billing_bill_email_payload',
          { p_society_id: societyId, p_bill_id: item.bill_id },
        ),
      );
      const { bill, recipients } = payload;
      const pdf = await renderWithRetry(bill);
      const subject = `Bill for ${formatBillingPeriod(bill.period_start)} - ${bill.unit_number}`;
      const link = billUrl(bill.id);
      const textContent = [
        `${bill.society_name} bill for ${bill.unit_label} ${bill.unit_number}.`,
        '',
        `Bill month: ${formatBillingPeriod(bill.period_start)}`,
        `Amount: ${formatRupees(bill.total_paise)}`,
        `Due date: ${formatBillingDate(bill.due_date)}`,
        `View bill (sign-in required): ${link}`,
        '',
        'The bill PDF is attached.',
      ].join('\n');
      let sentCount = 0;
      let failureReason: string | null = null;
      for (const recipient of recipients) {
        const result = await sendTransactionalEmail({
          to: {
            email: recipient.email,
            ...(recipient.name ? { name: recipient.name.slice(0, 120) } : {}),
          },
          subject,
          textContent,
          attachment: {
            name: fileName(bill.unit_number, bill.period_start),
            content: Buffer.from(pdf).toString('base64'),
          },
        });
        if (result.sent) {
          sentCount += 1;
        } else {
          failureReason = result.reason;
        }
      }

      const summary = {
        bill_id: bill.id,
        sent_count: sentCount,
        recipient_count: recipients.length,
      };
      const failed = failureReason !== null;
      const { error: updateError } = await privilegedClient
        .from('jobs')
        .update({
          status: failed ? 'failed' : 'succeeded',
          progress: 100,
          summary: failed
            ? { ...summary, failure_reason: failureReason }
            : summary,
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'running');
      if (updateError) {
        throw new Error('Could not finish a bill email job.', {
          cause: updateError,
        });
      }
    } catch (error) {
      const { error: updateError } = await privilegedClient
        .from('jobs')
        .update({
          status: 'failed',
          progress: 100,
          summary: {
            ...(queueItemSchema.safeParse(job.summary).success
              ? queueItemSchema.parse(job.summary)
              : {}),
            failure_reason: 'render_or_lookup',
          },
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'running');
      if (updateError) {
        throw new Error('Could not record a bill email failure.', {
          cause: updateError,
        });
      }
      console.error('Homeish bill email job failed.', {
        jobId: job.id,
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
}
