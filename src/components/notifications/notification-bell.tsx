// Show the current user's unread count and refresh it from the RLS-protected channel.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createNotificationBrowserClient } from '../../core/notifications/browser-client';

export function NotificationBell({
  dark = false,
  initialUnreadCount = 0,
}: {
  dark?: boolean;
  initialUnreadCount?: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    let active = true;
    const client = createNotificationBrowserClient();
    let channel: ReturnType<typeof client.channel> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackDelay = 5_000;

    async function subscribe() {
      const { data } = await client.auth.getUser();
      const userId = data.user?.id;
      if (!userId || !active) return;

      const refreshCount = async () => {
        const { count, error } = await client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('read_at', null);
        if (!error && active) setUnreadCount(count ?? 0);
      };

      const scheduleFallback = () => {
        if (!active || fallbackTimer !== undefined) return;
        fallbackTimer = setTimeout(() => {
          fallbackTimer = undefined;
          void refreshCount();
          fallbackDelay = Math.min(fallbackDelay * 2, 30_000);
          scheduleFallback();
        }, fallbackDelay);
      };

      await refreshCount();
      channel = client
        .channel(`notification-badge:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          refreshCount,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
            fallbackDelay = 5_000;
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            scheduleFallback();
          }
        });
    }

    void subscribe().catch(() => undefined);
    return () => {
      active = false;
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
      if (channel) void client.removeChannel(channel);
    };
  }, []);

  return (
    <Link
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
      className={`relative inline-flex size-12 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-focus ${dark ? 'text-dev-label hover:bg-surface/10' : 'text-brand hover:bg-brand-tint'}`}
      href="/notifications"
    >
      <svg
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" />
      </svg>
      {unreadCount > 0 ? (
        <span className="absolute right-0 top-0 min-w-5 rounded-full bg-danger px-1 text-center text-micro text-surface">
          <span aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
