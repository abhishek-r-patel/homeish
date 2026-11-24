// P57 development-only role previews captured for the public website with synthetic data.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AdminShell,
  CommitteeShell,
  GuardShell,
  HousekeepingShell,
  ResidentShell,
} from '@/components/app-shells';
import { LanguageProvider } from '@/components/language-provider';
import { Card, StatTile } from '@/components/ui/data-display';
import type { ModuleKey } from '@/core/modules';

const modules: ModuleKey[] = [
  'core',
  'visitor',
  'delivery',
  'billing',
  'service_request',
  'housekeeping',
  'notice',
];

function Preview() {
  const params = useSearchParams();
  const role = params.get('role') ?? 'admin';
  const Shell =
    role === 'resident'
      ? ResidentShell
      : role === 'committee'
        ? CommitteeShell
        : role === 'guard'
          ? GuardShell
          : role === 'housekeeping'
            ? HousekeepingShell
            : AdminShell;
  const title =
    role === 'resident'
      ? 'Good morning, Maya'
      : role === 'guard'
        ? 'Good morning, Gate desk'
        : role === 'housekeeping'
          ? 'Today’s work'
          : role === 'committee'
            ? 'Committee workspace'
            : 'Dashboard';
  const actions =
    role === 'resident'
      ? [
          'Pre-approve a guest',
          'View my bill',
          'Raise a request',
          'My household',
        ]
      : role === 'guard'
        ? ['Log visitor', 'Log delivery', 'Gate rounds', 'Vehicle check']
        : role === 'housekeeping'
          ? ['Record stock', 'Log issue', 'View inventory', 'Open requests']
          : [
              'Post a notice',
              'Review payments',
              'Generate bills',
              'Add expense',
            ];

  return (
    <Shell
      activeSocietyId="a57ab6d1-0000-4000-8000-000000000001"
      enabledModules={modules}
    >
      <section className="grid gap-space-5">
        <header className="grid gap-space-2">
          <p className="text-caption font-semibold uppercase text-brand">
            Synthetic Homeish preview
          </p>
          <h1 className="text-display font-bold">{title}</h1>
          <p className="text-body text-ink-muted">
            Invented society data for public product screenshots.
          </p>
        </header>
        {role === 'admin' || role === 'committee' ? (
          <div className="grid grid-cols-2 gap-space-3 expanded:grid-cols-4">
            <StatTile label="Visitors today" value="12" />
            <StatTile label="Open requests" value="7" />
            <StatTile label="Collected this month" value="₹4.5L" />
            <StatTile label="Outstanding" value="₹1.2L" />
          </div>
        ) : null}
        <Card title="Quick actions">
          <div className="grid grid-cols-2 gap-space-3 expanded:grid-cols-4">
            {actions.map((action) => (
              <div
                className="grid min-h-24 content-between rounded-md border border-rule bg-surface p-space-4 font-semibold"
                key={action}
              >
                <span aria-hidden="true" className="text-title text-brand">
                  →
                </span>
                {action}
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-space-4 expanded:grid-cols-2">
          <Card title="Needs attention">
            <ul className="grid gap-space-2 text-body">
              <li className="rounded-md border border-rule p-space-3">
                2 visitor requests waiting
              </li>
              <li className="rounded-md border border-rule p-space-3">
                3 deliveries need a response
              </li>
            </ul>
          </Card>
          <Card title="Coming up">
            <ul className="grid gap-space-2 text-body">
              <li className="rounded-md border border-rule p-space-3">
                Monthly meeting · 28 Nov
              </li>
              <li className="rounded-md border border-rule p-space-3">
                Bill due · 10 Dec
              </li>
            </ul>
          </Card>
        </div>
      </section>
    </Shell>
  );
}

export default function P57Fixture() {
  return (
    <LanguageProvider initialLocale="en" mode="device">
      <Suspense fallback={<p className="p-space-5">Loading preview…</p>}>
        <Preview />
      </Suspense>
    </LanguageProvider>
  );
}
