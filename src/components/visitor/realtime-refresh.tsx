// Refresh visitor server views from Realtime, with a five-second fallback.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createNotificationBrowserClient } from '@/core/notifications/browser-client';

export function VisitorRealtimeRefresh({ societyId }: { societyId: string }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;
    let subscribed = false;
    const client = createNotificationBrowserClient();
    const refresh = () => {
      if (active) router.refresh();
    };
    const fallback = window.setInterval(() => {
      if (!subscribed && navigator.onLine) refresh();
    }, 5_000);
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh();
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    const channel = client
      .channel(`visitor-entries:${societyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_entries',
          filter: `society_id=eq.${societyId}`,
        },
        refresh,
      )
      .subscribe((status) => {
        subscribed = status === 'SUBSCRIBED';
      });

    return () => {
      active = false;
      window.clearInterval(fallback);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      void client.removeChannel(channel);
    };
  }, [router, societyId]);

  return (
    <aside
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-space-2 rounded-md border p-space-3 ${online ? 'border-rule bg-surface' : 'border-danger bg-surface'}`}
      role="status"
    >
      <span>
        {online
          ? 'Visitor updates refresh automatically. Entries remain in the form if a request fails.'
          : 'Connection lost. Keep this page open; unsent visitor details remain in the form.'}
      </span>
      <button
        className="min-h-11 rounded-md border border-rule-strong px-space-3 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
        onClick={() => router.refresh()}
        type="button"
      >
        Retry refresh
      </button>
    </aside>
  );
}
