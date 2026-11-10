// Refresh the server-rendered inbox after an RLS-filtered Realtime change.
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createNotificationBrowserClient } from '../../core/notifications/browser-client';

export function NotificationRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const client = createNotificationBrowserClient();
    let channel: ReturnType<typeof client.channel> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackDelay = 5_000;

    const clearFallback = () => {
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    };
    const scheduleFallback = () => {
      if (!active || fallbackTimer !== undefined) return;
      fallbackTimer = setTimeout(() => {
        fallbackTimer = undefined;
        router.refresh();
        fallbackDelay = Math.min(fallbackDelay * 2, 30_000);
        scheduleFallback();
      }, fallbackDelay);
    };

    void client.auth
      .getUser()
      .then(({ data }) => {
        if (!data.user || !active) return;
        channel = client
          .channel(`notification-inbox:${data.user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${data.user.id}`,
            },
            () => router.refresh(),
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearFallback();
              fallbackDelay = 5_000;
            } else if (
              status === 'CHANNEL_ERROR' ||
              status === 'TIMED_OUT' ||
              status === 'CLOSED'
            ) {
              scheduleFallback();
            }
          });
      })
      .catch(scheduleFallback);

    return () => {
      active = false;
      clearFallback();
      if (channel) void client.removeChannel(channel);
    };
  }, [router]);

  return null;
}
