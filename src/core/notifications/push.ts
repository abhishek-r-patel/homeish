// Minimize Web Push data and apply retry/prune rules without exposing device keys.
import { notificationPath } from './links';
import { z } from 'zod';

const uuid = z.uuid();
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\b/gi;
const indianPhonePattern = /(?<!\w)(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const otherPhonePattern = /(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g;
const amountPattern = /(?:₹|INR\b|Rs\.?\s*)\s*[\d,]+(?:\.\d{1,2})?/gi;
const paymentIdentifierPattern =
  /\b(?:upi(?:\s*(?:id|address))?|utr|transaction ref(?:erence)?)\s*[:=]\s*[^,;.!?]*/gi;
const credentialPattern =
  /\b(?:otp|pin|password|passcode|token|secret|api[_ -]?key|verification code)\b(?:\s*(?:is|:|=)\s*)?\s*[A-Za-z0-9][A-Za-z0-9._-]{2,}\b/gi;
const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

export type MinimalPushPayload = {
  body: string;
  title: string;
  url: string;
};

export type PushSubscriptionRecord = {
  auth_secret: string;
  endpoint: string;
  id: string;
  p256dh: string;
};

export type PushFailure = Error & { statusCode?: number };

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return false;
    }

    const host = url.hostname.toLowerCase();
    const matchesProviderDomain = (domain: string) =>
      host === domain || host.endsWith(`.${domain}`);
    return (
      host === 'fcm.googleapis.com' ||
      matchesProviderDomain('push.apple.com') ||
      matchesProviderDomain('push.services.mozilla.com') ||
      matchesProviderDomain('notify.windows.com')
    );
  } catch {
    return false;
  }
}

function scrubPushText(value: string, maximumLength: number): string {
  return value
    .replace(emailPattern, '')
    .replace(indianPhonePattern, '')
    .replace(otherPhonePattern, '')
    .replace(amountPattern, '')
    .replace(paymentIdentifierPattern, '')
    .replace(credentialPattern, '')
    .replace(ipv4Pattern, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^(?:[,.;!?]\s*)+|(?:\s*[,.;!?])+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function notificationUrl(
  entityType: string | null,
  entityId: string | null,
): string {
  return (
    notificationPath(
      entityType,
      entityId,
      (value) => uuid.safeParse(value).success,
    ) ?? '/notifications'
  );
}

export function createMinimalPushPayload(notification: {
  body: string;
  entity_id: string | null;
  entity_type: string | null;
  title: string;
}): MinimalPushPayload {
  return {
    title: scrubPushText(notification.title, 120) || 'Homeish',
    body: scrubPushText(notification.body, 300),
    url: notificationUrl(notification.entity_type, notification.entity_id),
  };
}

export type PushDeliveryOptions = {
  markSuccessful: (subscriptionId: string) => Promise<void>;
  prune: (subscriptionId: string) => Promise<void>;
  send: (
    subscription: PushSubscriptionRecord,
    payload: MinimalPushPayload,
  ) => Promise<void>;
  sleep?: (milliseconds: number) => Promise<void>;
};

export async function deliverPushToSubscriptions(
  subscriptions: readonly PushSubscriptionRecord[],
  payload: MinimalPushPayload,
  options: PushDeliveryOptions,
): Promise<{ failed: number; pruned: number; sent: number }> {
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let sent = 0;
  let failed = 0;
  let pruned = 0;

  for (const subscription of subscriptions) {
    let completed = false;
    if (!isAllowedPushEndpoint(subscription.endpoint)) {
      try {
        await options.prune(subscription.id);
        pruned += 1;
      } catch {
        failed += 1;
      }
      continue;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await options.send(subscription, payload);
      } catch (error) {
        const statusCode = (error as PushFailure).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await options.prune(subscription.id);
            pruned += 1;
          } catch {
            failed += 1;
          }
          completed = true;
          break;
        }
        const retryable =
          statusCode === undefined || statusCode === 429 || statusCode >= 500;
        if (attempt === 0 && retryable) {
          await sleep(250);
          continue;
        }
        failed += 1;
        completed = true;
        break;
      }
      sent += 1;
      completed = true;
      try {
        await options.markSuccessful(subscription.id);
      } catch {
        // The push already reached the device; do not retry and create a duplicate.
      }
      break;
    }
    if (!completed) failed += 1;
  }

  return { sent, failed, pruned };
}
