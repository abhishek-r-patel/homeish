// Refresh household actions when gate records or notifications change.
'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { createNotificationBrowserClient } from '@/core/notifications/browser-client';

function subscribeToConnection(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

export function HomeRealtimeRefresh({
  societyId,
  userId,
  visitorEnabled,
  deliveryEnabled,
  nextResponseAt,
  serverNow,
  unitIds,
}: {
  societyId: string;
  userId: string;
  visitorEnabled: boolean;
  deliveryEnabled: boolean;
  nextResponseAt: string | null;
  serverNow: string;
  unitIds: readonly string[];
}) {
  const router = useRouter();
  const { translate: t } = useUiTranslator();
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    let active = true;
    let subscribed = false;
    const client = createNotificationBrowserClient();
    const refresh = () => {
      if (active && navigator.onLine) router.refresh();
    };
    const fallback = window.setInterval(() => {
      if (!subscribed) refresh();
    }, 5_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    let channel = client.channel(`resident-home:${societyId}:${userId}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      refresh,
    );
    for (const unitId of unitIds) {
      if (visitorEnabled) {
        channel = channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitor_entries',
            filter: `unit_id=eq.${unitId}`,
          },
          refresh,
        );
      }
      if (deliveryEnabled) {
        channel = channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'delivery_entries',
            filter: `unit_id=eq.${unitId}`,
          },
          refresh,
        );
      }
    }
    channel.subscribe((status) => {
      subscribed = status === 'SUBSCRIBED';
    });

    return () => {
      active = false;
      window.clearInterval(fallback);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      void client.removeChannel(channel);
    };
  }, [deliveryEnabled, router, societyId, unitIds, userId, visitorEnabled]);

  useEffect(() => {
    if (!nextResponseAt) return;
    const delay = Math.max(
      0,
      Date.parse(nextResponseAt) - Date.parse(serverNow),
    );
    const timer = window.setTimeout(
      () => {
        if (navigator.onLine) router.refresh();
      },
      Math.min(delay + 250, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [nextResponseAt, router, serverNow]);

  return online ? null : (
    <Banner tone="danger">
      {t('Connection lost. Home may be out of date until you reconnect.')}
    </Banner>
  );
}
