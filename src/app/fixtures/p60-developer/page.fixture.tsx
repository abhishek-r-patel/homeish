// Exercise P60 developer release notes and counts-only usage with synthetic data.
'use client';

import { Card } from '@/components/ui/data-display';
import { DeveloperPlatformUpdates } from '@/components/updates/developer-updates';
import { DeveloperUsageTable } from '@/components/developer/usage-table';

export default function P60DeveloperFixture() {
  return (
    <main className="mx-auto grid max-w-content-wide gap-space-5 bg-dev-bar p-space-5 text-surface">
      <h1 className="text-title font-semibold">P60 developer workspace</h1>
      <Card title="Release notes">
        <DeveloperPlatformUpdates
          saveAction={async () => ({
            ok: true,
            message: 'Release note saved.',
          })}
          updates={[
            {
              id: '11111111-1111-4111-8111-111111111111',
              title: 'CSV imports are ready',
              body: 'Import society records from the admin workspace.',
              href: '/admin/features',
              publishedAt: '2026-11-25T10:00:00+05:30',
              withdrawnAt: null,
              updatedAt: '2026-11-25T10:00:00+05:30',
            },
          ]}
          withdrawAction={async () => ({
            ok: true,
            message: 'Release note withdrawn.',
          })}
        />
      </Card>
      <Card title="Usage overview">
        <DeveloperUsageTable
          rows={[
            {
              societyId: '22222222-2222-4222-8222-222222222222',
              societyName: 'Synthetic Society',
              peopleJoined: 42,
              visitors30d: 18,
              requests30d: 9,
              bills30d: 42,
              notices30d: 6,
              modulesOn: 8,
            },
          ]}
        />
      </Card>
    </main>
  );
}
