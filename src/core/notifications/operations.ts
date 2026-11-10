// Read and update notification records only through the signed-in user client.
import 'server-only';
import { z } from 'zod';
import type { Database } from '../db/database.types';
import { createRequestId } from '../errors';
import { buildRequestContext } from '../tenancy/request-context';

type NotificationRow = Pick<
  Database['public']['Tables']['notifications']['Row'],
  | 'id'
  | 'society_id'
  | 'user_id'
  | 'type'
  | 'title'
  | 'body'
  | 'entity_type'
  | 'entity_id'
  | 'read_at'
  | 'created_at'
>;

const notificationIdSchema = z.uuid();

export async function listNotifications(
  limit = 50,
): Promise<NotificationRow[]> {
  const context = await buildRequestContext(createRequestId());
  const { data, error } = await context.db
    .from('notifications')
    .select(
      'id, society_id, user_id, type, title, body, entity_type, entity_id, read_at, created_at',
    )
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))));

  if (error) {
    throw new Error('Could not load notifications.', { cause: error });
  }
  return data;
}

export async function countUnreadNotifications(): Promise<number> {
  const context = await buildRequestContext(createRequestId());
  const { count, error } = await context.db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', context.userId)
    .is('read_at', null);

  if (error) {
    throw new Error('Could not count unread notifications.', { cause: error });
  }
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const parsedId = notificationIdSchema.safeParse(notificationId);
  if (!parsedId.success) {
    throw new Error('The notification identifier is invalid.');
  }

  const context = await buildRequestContext(createRequestId());
  const { error } = await context.db.rpc('mark_notification_read', {
    p_notification_id: parsedId.data,
  });
  if (error) {
    throw new Error('Could not mark the notification as read.', {
      cause: error,
    });
  }
}

export async function markAllNotificationsRead() {
  const context = await buildRequestContext(createRequestId());
  const { error } = await context.db.rpc('mark_all_notifications_read');
  if (error) {
    throw new Error('Could not mark notifications as read.', { cause: error });
  }
}
