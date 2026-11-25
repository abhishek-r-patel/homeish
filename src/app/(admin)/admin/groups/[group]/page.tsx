// List one enabled, permitted admin topic and its actionable counts.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createRequestId } from '@/core/errors';
import {
  ADMIN_NAVIGATION_TOPICS,
  getModuleDefinition,
  getRoleNavigationGroups,
} from '@/core/modules';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { getAdminHome } from '@/core/home/admin-operations';
import { getAdminGroupStatus } from '@/core/home/group-status';

export const metadata = {
  title: 'Workspace section | Homeish',
  robots: { index: false, follow: false },
};

function groupSlug(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}

export default async function AdminGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: requestedGroup } = await params;
  const context = await buildRequestContext(createRequestId());
  const role = context.roles.includes('admin') ? 'admin' : 'committee';
  const topic = ADMIN_NAVIGATION_TOPICS.find(
    (candidate) => groupSlug(candidate) === requestedGroup,
  );
  if (!topic) notFound();

  const items =
    getRoleNavigationGroups([role], [...context.enabledModules]).find(
      (group) => group.topic === topic,
    )?.items ?? [];
  const snapshot = (await getAdminHome()).snapshot;
  const waitingCount = (href: string) => {
    if (href === '/admin/requests' && snapshot.requests?.status === 'ok') {
      return snapshot.requests.open;
    }
    if (href === '/admin/billing' && snapshot.billing?.status === 'ok') {
      return snapshot.billing.pending_payments;
    }
    if (href === '/admin/members' && snapshot.registrations?.status === 'ok') {
      return snapshot.registrations.pending;
    }
    if (href === '/admin/tenancy' && snapshot.tenancy?.status === 'ok') {
      return snapshot.tenancy.pending;
    }
    if (href === '/admin/amc' && snapshot.amc?.status === 'ok') {
      return snapshot.amc.urgent;
    }
    if (href === '/admin/housekeeping' && snapshot.stock?.status === 'ok') {
      return snapshot.stock.low;
    }
    return null;
  };

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-micro font-semibold uppercase tracking-wide text-brand">
          Workspace
        </p>
        <h1 className="text-heading font-semibold">{topic}</h1>
        <p className="max-w-prose text-body text-ink-muted">
          Choose an available destination for this part of society work.
        </p>
      </header>
      {items.length ? (
        <ul className="grid gap-space-3 medium:grid-cols-2 expanded:grid-cols-3">
          {items.map((item) => {
            const count = waitingCount(item.href);
            const status = getAdminGroupStatus(item.href, snapshot);
            return (
              <li key={item.href}>
                <Link
                  className="group flex min-h-28 flex-col justify-between rounded-md border border-rule bg-surface p-space-4 shadow-card outline-none transition-colors hover:border-brand hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-focus"
                  href={item.href}
                >
                  <span className="flex items-start justify-between gap-space-3">
                    <span className="text-title font-semibold">
                      {item.label}
                    </span>
                    {count !== null && count > 0 ? (
                      <span className="rounded-full bg-brand px-space-2 py-space-1 text-micro text-on-brand">
                        {count} waiting
                      </span>
                    ) : null}
                  </span>
                  <span className="grid gap-space-1">
                    <span className="text-caption text-ink-muted">
                      {getModuleDefinition(item.moduleKey).name}
                    </span>
                    {status ? (
                      <span className="text-caption text-ink-muted">
                        {status}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-body-strong text-brand">Open →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-rule bg-surface p-space-6 text-body text-ink-muted">
          No destinations in this section are enabled for the active society.
        </div>
      )}
    </section>
  );
}
