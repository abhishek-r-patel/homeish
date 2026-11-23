// Mount Vercel Web Analytics only on the approved Beta public routes.
'use client';
import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import {
  isPublicAnalyticsPath,
  sanitizeWebAnalyticsEvent,
} from '@/core/analytics/web';

export function HomeishWebAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  if (!enabled || !isPublicAnalyticsPath(pathname)) return null;
  return (
    <Analytics
      beforeSend={sanitizeWebAnalyticsEvent}
      debug={false}
      mode="production"
    />
  );
}
