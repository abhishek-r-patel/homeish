// Build permission-filtered status lines from the existing admin-home snapshot.
import { formatRupees } from '../billing/format';
import type { AdminHomeSnapshot } from './admin-validation';

function daysSince(serverNow: string, occurredAt: string) {
  return Math.max(
    0,
    Math.floor(
      (Date.parse(serverNow) - Date.parse(occurredAt)) / (24 * 60 * 60 * 1000),
    ),
  );
}

export function getAdminGroupStatus(
  href: string,
  snapshot: AdminHomeSnapshot,
): string | null {
  if (href === '/admin/billing' && snapshot.billing?.status === 'ok') {
    return `${formatRupees(snapshot.billing.collected_month_paise)} collected this month`;
  }
  if (href === '/admin/visitors' && snapshot.visitors?.status === 'ok') {
    const count = snapshot.visitors.inside;
    return `${count} visitor${count === 1 ? '' : 's'} inside now`;
  }
  if (href === '/admin/notices' && snapshot.activity?.status === 'ok') {
    const latest = snapshot.activity.items.find(
      (item) => item.kind === 'notice_published',
    );
    if (!latest) return null;
    const days = daysSince(snapshot.server_now, latest.occurred_at);
    if (days === 0) return 'Last notice posted today';
    return `Last notice posted ${days} day${days === 1 ? '' : 's'} ago`;
  }
  return null;
}
