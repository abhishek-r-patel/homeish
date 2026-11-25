// Exercise P60 reports, updates, visibility and five-slot phone navigation.
'use client';

import { useState } from 'react';
import { AdminShell, ResidentShell } from '@/components/app-shells';
import { LanguageProvider } from '@/components/language-provider';
import { ReportsHub } from '@/components/home/reports-hub';
import { PlatformUpdateList } from '@/components/updates/update-list';
import { ResidentModuleVisibilityControl } from '@/components/developer/console-controls';
import { getAllowedReports } from '@/core/home/reports';
import type { PlatformUpdate } from '@/core/updates/operations';

const updates: PlatformUpdate[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'CSV imports are ready',
    body: 'Import flats and residents from one reviewed preview.',
    href: '/admin/structure',
    publishedAt: '2026-11-25T10:00:00+05:30',
    withdrawnAt: null,
    updatedAt: '2026-11-25T10:00:00+05:30',
    hasRead: false,
  },
];

export default function P60Fixture() {
  const [view, setView] = useState<'resident' | 'admin'>('resident');
  const enabledModules = new Set([
    'core',
    'visitor',
    'billing',
    'service_request',
    'expense',
  ] as const);

  const content = (
    <section className="grid gap-space-5">
      <div className="flex flex-wrap gap-space-2">
        <button
          className="min-h-12 rounded-md border border-rule-strong px-space-4"
          onClick={() => setView('resident')}
          type="button"
        >
          Resident shell
        </button>
        <button
          className="min-h-12 rounded-md border border-rule-strong px-space-4"
          onClick={() => setView('admin')}
          type="button"
        >
          Admin shell
        </button>
      </div>
      <h1 className="text-title font-semibold">P60 synthetic workspace</h1>
      <section aria-label="Report hub example">
        <ReportsHub reports={getAllowedReports(['admin'], enabledModules)} />
      </section>
      <section aria-label="What is new example">
        <PlatformUpdateList
          markReadAction={async () => ({
            ok: true,
            message: 'Release note marked read.',
          })}
          updates={updates}
        />
      </section>
      <section aria-label="Module visibility example">
        <ResidentModuleVisibilityControl
          action={async () => ({
            ok: true,
            message: 'Resident visibility saved.',
          })}
          moduleKey="visitor"
          residentsVisible
          societyId="11111111-1111-4111-8111-111111111111"
        />
      </section>
    </section>
  );

  return (
    <LanguageProvider initialLocale="en" mode="device">
      {view === 'resident' ? (
        <ResidentShell
          enabledModules={['visitor', 'billing', 'service_request', 'delivery']}
          quickActions={[
            {
              key: 'visitor.preapprove',
              href: '/visitors',
              label: 'Pre-approve a guest',
              moduleKey: 'visitor',
            },
          ]}
        >
          {content}
        </ResidentShell>
      ) : (
        <AdminShell
          enabledModules={['visitor', 'billing', 'service_request', 'expense']}
          quickActions={[
            {
              key: 'notice.create',
              href: '/admin/notices/new',
              label: 'Post a notice',
              moduleKey: 'notice',
            },
          ]}
        >
          {content}
        </AdminShell>
      )}
    </LanguageProvider>
  );
}
