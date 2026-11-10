// Send notifications via Node-only Web Push without loading it through the shared barrel.
import 'server-only';
import { sendNotification, setVapidDetails } from 'web-push';
import { publicEnvironment } from '../config/public-env';
import { serverEnvironment } from '../config/server-env';
import {
  createMinimalPushPayload,
  deliverPushToSubscriptions,
} from '../notifications/push';
import { privilegedClient } from './server-client';

const notificationDatabase = privilegedClient;

async function loadNotification(notificationId: string) {
  try {
    return await notificationDatabase
      .from('notifications')
      .select('id, user_id, title, body, entity_type, entity_id')
      .eq('id', notificationId)
      .maybeSingle();
  } catch {
    return null;
  }
}

async function loadSubscriptions(userId: string) {
  try {
    return await notificationDatabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_secret')
      .eq('user_id', userId);
  } catch {
    return null;
  }
}

export async function sendNotificationPush(notificationId: string) {
  const notificationResult = await loadNotification(notificationId);
  if (!notificationResult) {
    console.warn('Homeish push notification was not found.', {
      reason: 'database_read_failed',
    });
    return { failed: 0, pruned: 0, sent: 0 };
  }
  const { data: notification, error: notificationError } = notificationResult;

  if (notificationError || !notification) {
    console.warn('Homeish push notification was not found.', {
      reason: notificationError ? 'database_read_failed' : 'missing_record',
    });
    return { failed: 0, pruned: 0, sent: 0 };
  }

  const subscriptionsResult = await loadSubscriptions(notification.user_id);
  if (!subscriptionsResult) {
    console.warn('Homeish push subscriptions could not be loaded.', {
      reason: 'database_read_failed',
    });
    return { failed: 0, pruned: 0, sent: 0 };
  }
  const { data: subscriptions, error: subscriptionsError } =
    subscriptionsResult;

  if (subscriptionsError) {
    console.warn('Homeish push subscriptions could not be loaded.', {
      reason: 'database_read_failed',
    });
    return { failed: 0, pruned: 0, sent: 0 };
  }
  if (subscriptions.length === 0) {
    return { failed: 0, pruned: 0, sent: 0 };
  }

  try {
    setVapidDetails(
      serverEnvironment.server.VAPID_SUBJECT,
      publicEnvironment.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      serverEnvironment.server.VAPID_PRIVATE_KEY,
    );
    const payload = createMinimalPushPayload(notification);
    const result = await deliverPushToSubscriptions(subscriptions, payload, {
      async send(subscription, message) {
        try {
          await sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth_secret,
                p256dh: subscription.p256dh,
              },
            },
            JSON.stringify(message),
            { TTL: 60, timeout: 5_000 },
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          const failure = new Error('Push delivery failed.') as Error & {
            statusCode?: number;
          };
          if (statusCode !== undefined) failure.statusCode = statusCode;
          throw failure;
        }
      },
      async prune(subscriptionId) {
        const { error } = await notificationDatabase
          .from('push_subscriptions')
          .delete()
          .eq('id', subscriptionId);
        if (error) throw error;
      },
      async markSuccessful(subscriptionId) {
        const { error } = await notificationDatabase
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString() })
          .eq('id', subscriptionId);
        if (error) throw error;
      },
    });

    if (result.failed > 0) {
      console.warn('Homeish push delivery had failures.', {
        failed: result.failed,
      });
    }
    return result;
  } catch {
    console.warn('Homeish push delivery could not be initialized.', {
      reason: 'delivery_setup_failed',
    });
    return { failed: subscriptions.length, pruned: 0, sent: 0 };
  }
}

export async function sendNotificationPushesForRequest(requestId: string) {
  let notificationIds: string[];
  try {
    const result = await notificationDatabase
      .from('notifications')
      .select('id')
      .eq('request_id', requestId);
    if (result.error) {
      console.warn('Homeish push notifications could not be loaded.', {
        reason: 'database_read_failed',
      });
      return { failed: 1, pruned: 0, sent: 0 };
    }
    notificationIds = result.data.map(({ id }) => id);
  } catch {
    console.warn('Homeish push notifications could not be loaded.', {
      reason: 'database_read_failed',
    });
    return { failed: 1, pruned: 0, sent: 0 };
  }

  const results = await Promise.all(
    notificationIds.map((id) => sendNotificationPush(id)),
  );
  return results.reduce(
    (total, result) => ({
      failed: total.failed + result.failed,
      pruned: total.pruned + result.pruned,
      sent: total.sent + result.sent,
    }),
    { failed: 0, pruned: 0, sent: 0 },
  );
}
