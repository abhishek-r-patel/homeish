// Exercise the member contact log and the communication dashboard with synthetic in-memory data.
'use client';
import { useState } from 'react';
import { ContactLogScreen } from '@/components/communication/contact-log';
import { CommunicationDashboardScreen } from '@/components/communication/dashboard';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  contactLogSaveInputSchema,
  type CommunicationDashboard,
  type ContactLogEntry,
  type ContactLogPage,
} from '@/core/communication/validation';

const today = '2026-11-20';
const adminId = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';
const committeeId = 'a2d55fc3-0751-4b79-86c1-5b3e25942392';
const unitId = 'b1d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'c1d55fc3-0751-4b79-86c1-5b3e25942392';

const options: Omit<ContactLogPage, 'logs'> = {
  can_manage: true,
  handlers: [
    { id: adminId, name: 'Society office' },
    { id: committeeId, name: 'Committee member' },
  ],
  units: [
    { id: unitId, label: 'A-101' },
    { id: 'b2d55fc3-0751-4b79-86c1-5b3e25942392', label: 'B-204' },
  ],
  requests: [{ id: requestId, label: 'Lift noise (Open)' }],
};

const overdueEntry: ContactLogEntry = {
  id: 'd1d55fc3-0751-4b79-86c1-5b3e25942392',
  contact_on: '2026-11-12',
  unit_id: unitId,
  unit_label: 'A-101',
  contact_type: 'complaint',
  channel: 'phone',
  direction: 'incoming',
  summary: 'Lift makes a grinding noise at night.',
  handled_by: committeeId,
  handled_by_name: 'Committee member',
  follow_up_on: '2026-11-15',
  status: 'follow_up',
  closed_at: null,
  service_request_id: requestId,
  days_open: 8,
  follow_up_overdue: true,
  created_at: '2026-11-12T05:00:00.000Z',
  updated_at: '2026-11-12T05:00:00.000Z',
};

const dashboard: CommunicationDashboard = {
  month: '2026-11',
  notices: { posted: 4, removed: 1, planned_now: 2 },
  meetings: { notices_issued: 1 },
  events: null,
  sos: { raised: 0 },
  requests: { received: 9, resolved: 6, avg_days: 2.5 },
  contact_log: { logged: 3, closed: 1, open_now: 2, follow_up_overdue: 1 },
};

function daysBetween(from: string, to: string) {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export default function CommunicationFixturePage() {
  const [role, setRole] = useState<'admin' | 'committee'>('admin');
  const [logs, setLogs] = useState<ContactLogEntry[]>([overdueEntry]);
  const saveLog: ModuleFormAction = async (data) => {
    if (role !== 'admin')
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Only admins can change the contact log.',
      };
    const parsed = contactLogSaveInputSchema.safeParse(
      JSON.parse(String(data.get('input') ?? 'null')),
    );
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    const v = parsed.data;
    const previous = logs.find((row) => row.id === v.logId);
    const now = new Date().toISOString();
    const entry: ContactLogEntry = {
      id: v.logId ?? crypto.randomUUID(),
      contact_on: v.contactOn,
      unit_id: v.unitId,
      unit_label:
        options.units.find(({ id }) => id === v.unitId)?.label ?? null,
      contact_type: v.contactType,
      channel: v.channel,
      direction: v.direction,
      summary: v.summary,
      handled_by: v.handledBy,
      handled_by_name:
        options.handlers.find(({ id }) => id === v.handledBy)?.name ?? null,
      follow_up_on: v.followUpOn,
      status: v.status,
      closed_at: v.status === 'closed' ? (previous?.closed_at ?? now) : null,
      service_request_id: v.serviceRequestId,
      days_open: daysBetween(v.contactOn, today),
      follow_up_overdue:
        v.status !== 'closed' && v.followUpOn !== null && v.followUpOn < today,
      created_at: previous?.created_at ?? now,
      updated_at: now,
    };
    setLogs((rows) =>
      [entry, ...rows.filter((row) => row.id !== entry.id)].sort((a, b) =>
        b.contact_on.localeCompare(a.contact_on),
      ),
    );
    return { ok: true, message: 'Contact saved. (synthetic, nothing saved)' };
  };
  return (
    <main className="mx-auto grid min-h-dvh w-full min-w-0 max-w-content-default gap-space-6 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic communication fixture" tone="info">
        Development-only simulated actions. No database writes. Reload to reset.
      </Banner>
      <label>
        Fixture role
        <select
          value={role}
          onChange={(event) =>
            setRole(event.target.value === 'admin' ? 'admin' : 'committee')
          }
        >
          <option value="admin">admin</option>
          <option value="committee">committee</option>
        </select>
      </label>
      <ContactLogScreen
        key={role}
        view={{
          ...options,
          logs,
          currentUserId: adminId,
          can_manage: role === 'admin',
        }}
        filter="all"
        today={today}
        actions={{ saveLog }}
      />
      <CommunicationDashboardScreen
        dashboard={dashboard}
        currentMonth="2026-11"
      />
    </main>
  );
}
