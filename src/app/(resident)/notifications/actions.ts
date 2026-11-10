// Mutate only the current user's notification read state.
'use server';

import { revalidatePath } from 'next/cache';
import { createRequestId } from '@/core/errors';
import { logUnexpectedError } from '@/core/logging/error-logger';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/core/notifications/operations';

async function reportFailure(error: unknown, route: string) {
  await logUnexpectedError(error, {
    requestId: createRequestId(),
    route,
    source: 'server',
  });
}

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = formData.get('notificationId');
  if (typeof notificationId !== 'string') return;

  try {
    await markNotificationRead(notificationId);
    revalidatePath('/notifications');
  } catch (error) {
    await reportFailure(error, '/notifications');
  }
}

export async function markAllNotificationsReadAction() {
  try {
    await markAllNotificationsRead();
    revalidatePath('/notifications');
  } catch (error) {
    await reportFailure(error, '/notifications');
  }
}
