// Exercise P59 synthetic history, undo and role-preview states without hosted data.
'use client';

import { useState } from 'react';
import { AuditHistoryList } from '@/components/audit/history-list';
import { Card } from '@/components/ui/data-display';
import { buildRolePreview } from '@/core/home/role-preview';
import type { RolePreviewRole } from '@/core/home/role-preview';
import type { AuditHistoryRow } from '@/core/audit/history';

const rows: AuditHistoryRow[] = [
  {
    id: '101',
    action: 'billing.settings.update',
    category: 'Billing',
    actorName: 'Synthetic Admin',
    actorRole: 'admin',
    createdAt: '2026-11-25T07:00:00.000+05:30',
    before: { settings: { due_day_of_month: 10 } },
    after: { settings: { due_day_of_month: 15 } },
    canUndo: true,
    undoReason: null,
  },
  {
    id: '100',
    action: 'visitor.override',
    category: 'Visitors',
    actorName: 'Synthetic Admin',
    actorRole: 'admin',
    createdAt: '2026-11-24T07:00:00.000+05:30',
    before: null,
    after: null,
    canUndo: false,
    undoReason: 'This change is not an undoable setting.',
  },
];

export default function P59Fixture() {
  const [role, setRole] = useState<RolePreviewRole>('resident');
  const preview = buildRolePreview(role, [
    'core',
    'visitor',
    'delivery',
    'billing',
    'notice',
    'service_request',
  ]);
  return (
    <main className="mx-auto grid max-w-content-wide gap-space-6 p-space-5">
      <h1 className="text-title font-semibold">P59 synthetic admin preview</h1>
      <Card title="Change history">
        <AuditHistoryList
          rows={rows}
          undoAction={async () => ({
            ok: true,
            message: 'The setting change was undone.',
          })}
        />
      </Card>
      <Card title="Role preview">
        <label className="grid max-w-sm gap-space-1 text-body-strong">
          Preview role
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            onChange={(event) =>
              setRole(event.currentTarget.value as RolePreviewRole)
            }
            value={role}
          >
            <option value="resident">Resident</option>
            <option value="guard">Guard</option>
            <option value="committee">Committee member</option>
            <option value="hk_supervisor">Housekeeping supervisor</option>
          </select>
        </label>
        <div
          aria-label={`${preview.label} picture`}
          className="mt-space-4 grid gap-space-3 rounded-md border border-rule bg-paper p-space-4"
          inert
        >
          <p className="text-body-strong">{preview.label} Home</p>
          <p className="text-caption text-ink-muted">
            {preview.actions.join(' · ')}
          </p>
          <p className="text-caption text-ink-muted">
            {preview.tabs.join(' · ')}
          </p>
        </div>
        <ul
          aria-label={`${preview.label} accessible preview`}
          className="mt-space-4 list-disc pl-space-5"
        >
          {preview.groups.flatMap((group) =>
            group.items.map((item) => (
              <li key={`${group.name}:${item}`}>{item}</li>
            )),
          )}
        </ul>
      </Card>
    </main>
  );
}
