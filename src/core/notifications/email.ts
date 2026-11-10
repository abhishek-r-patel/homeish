// Best-effort Brevo delivery with a deployment quota and bounded retries.
import { z } from 'zod';

const emailMessageSchema = z
  .object({
    htmlContent: z.string().max(20_000).optional(),
    subject: z.string().trim().min(1).max(200),
    textContent: z.string().max(20_000).optional(),
    to: z
      .object({
        email: z.email().max(254),
        name: z.string().trim().max(120).optional(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (message) =>
      message.htmlContent !== undefined || message.textContent !== undefined,
    { message: 'Email content is required.' },
  );

export type TransactionalEmail = z.infer<typeof emailMessageSchema>;

export type EmailQuotaReservation = {
  allowed: boolean;
  sent_count: number;
  should_alert: boolean;
};

export type EmailDeliveryResult =
  | { sent: true }
  | {
      sent: false;
      reason:
        | 'invalid'
        | 'not_configured'
        | 'quota'
        | 'quota_unavailable'
        | 'provider';
    };

type Fetcher = typeof fetch;
type Logger = (
  event: string,
  context: Readonly<Record<string, unknown>>,
) => void;

export type TransactionalEmailOptions = {
  apiKey?: string;
  alertEmail?: string;
  dailyQuota?: number;
  fetcher?: Fetcher;
  fromAddress?: string;
  fromName?: string;
  logger?: Logger;
  reserveQuota: () => Promise<EmailQuotaReservation>;
  timeoutMs?: number;
};

type BrevoPayload = {
  htmlContent?: string;
  sender: { email: string; name: string };
  subject: string;
  textContent?: string;
  to: { email: string; name?: string }[];
};

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

export function createTransactionalEmailSender({
  apiKey,
  alertEmail,
  dailyQuota,
  fetcher = fetch,
  fromAddress,
  fromName = 'Homeish',
  logger = (event, context) => console.warn(event, context),
  reserveQuota,
  timeoutMs = 5_000,
}: TransactionalEmailOptions) {
  const safeLog = (
    event: string,
    context: Readonly<Record<string, unknown>>,
  ) => {
    try {
      logger(event, context);
    } catch {
      // Logging must never turn a best-effort email failure into an action failure.
    }
  };

  async function sendWithRetry(payload: BrevoPayload): Promise<boolean> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response | undefined;
      let networkFailure = false;
      try {
        response = await fetcher('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': apiKey ?? '',
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch {
        networkFailure = true;
      } finally {
        clearTimeout(timeout);
      }

      if (response?.ok) return true;
      const retryable =
        networkFailure ||
        (response !== undefined && isRetryableStatus(response.status));
      if (attempt === 1 && retryable) continue;

      safeLog('Homeish transactional email delivery failed.', {
        attempt,
        reason: networkFailure ? 'network_or_timeout' : 'provider_response',
        ...(response ? { status: response.status } : {}),
      });
      return false;
    }
    return false;
  }

  async function sendQuotaAlert(sentCount: number) {
    if (!alertEmail || !apiKey || !fromAddress) return;
    let quota: EmailQuotaReservation;
    try {
      quota = await reserveQuota();
    } catch {
      safeLog('Homeish email quota alert reservation failed.', {
        reason: 'quota_unavailable',
      });
      return;
    }
    if (!quota.allowed) {
      safeLog('Homeish email quota alert was held by its daily quota.', {
        reason: 'quota',
      });
      return;
    }
    const sent = await sendWithRetry({
      sender: { email: fromAddress, name: fromName },
      to: [{ email: alertEmail }],
      subject: 'Homeish email quota is nearing its daily limit',
      textContent: `Homeish has sent ${sentCount} transactional emails today, reaching at least 80% of the configured daily quota of ${dailyQuota}.`,
    });
    if (!sent) {
      safeLog('Homeish email quota alert could not be delivered.', {
        event: 'daily_quota_threshold',
      });
    }
  }

  return async function sendTransactionalEmail(
    input: TransactionalEmail,
  ): Promise<EmailDeliveryResult> {
    if (!apiKey || !fromAddress || !dailyQuota) {
      return { sent: false, reason: 'not_configured' };
    }
    const parsed = emailMessageSchema.safeParse(input);
    if (!parsed.success) return { sent: false, reason: 'invalid' };

    let quota: EmailQuotaReservation;
    try {
      quota = await reserveQuota();
    } catch {
      safeLog('Homeish transactional email quota check failed.', {
        reason: 'quota_unavailable',
      });
      return { sent: false, reason: 'quota_unavailable' };
    }

    if (quota.should_alert) {
      await sendQuotaAlert(quota.sent_count);
    }
    if (!quota.allowed) {
      safeLog('Homeish transactional email was held by its daily quota.', {
        reason: 'quota',
      });
      return { sent: false, reason: 'quota' };
    }

    const payload: BrevoPayload = {
      sender: { email: fromAddress, name: fromName },
      to: [parsed.data.to],
      subject: parsed.data.subject,
      ...(parsed.data.textContent
        ? { textContent: parsed.data.textContent }
        : {}),
      ...(parsed.data.htmlContent
        ? { htmlContent: parsed.data.htmlContent }
        : {}),
    };
    return (await sendWithRetry(payload))
      ? { sent: true }
      : { sent: false, reason: 'provider' };
  };
}
