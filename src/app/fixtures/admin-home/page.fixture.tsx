// Exercise the admin home (A-01) with synthetic data without accessing hosted services.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminShell, CommitteeShell } from '@/components/app-shells';
import { AdminHome } from '@/components/home/admin-home';
import { LanguageProvider } from '@/components/language-provider';
import { Banner, Skeleton } from '@/components/ui/feedback';
import type { AdminActionsFeed } from '@/core/home/admin-operations';
import type { AdminHomeSnapshot } from '@/core/home/admin-validation';
import type { ModuleKey } from '@/core/modules';

const enabledModules: ModuleKey[] = [
  'core',
  'visitor',
  'billing',
  'service_request',
  'housekeeping',
  'amc',
  'notice',
  'tenancy',
  'meeting',
];
const sample: AdminHomeSnapshot = {
  timezone: 'Asia/Kolkata',
  server_now: '2026-11-20T08:00:00Z',
  visitors: { status: 'ok', today: 12, inside: 3 },
  requests: { status: 'ok', open: 7, overdue: 2 },
  billing: {
    status: 'ok',
    collected_month_paise: '45000000',
    outstanding_paise: '1250000',
    overdue_units: 4,
    pending_payments: 2,
  },
  amc: { status: 'ok', urgent: 1 },
  stock: { status: 'ok', low: 3, out: 1 },
  tenancy: { status: 'ok', pending: 1 },
  registrations: { status: 'ok', pending: 2 },
  meeting: {
    status: 'ok',
    next: {
      id: 'b1d55fc3-0751-4b79-86c1-5b3e25942392',
      title: 'Annual general meeting',
      starts_at: '2026-11-28T12:30:00Z',
      venue: 'Clubhouse',
    },
  },
  activity: {
    status: 'ok',
    items: [
      {
        id: 'b2d55fc3-0751-4b79-86c1-5b3e25942392',
        kind: 'request_opened',
        title: 'Plumbing',
        unit_number: 'A-101',
        occurred_at: '2026-11-20T07:30:00Z',
      },
      {
        id: 'b3d55fc3-0751-4b79-86c1-5b3e25942392',
        kind: 'notice_published',
        title: 'Water shutdown on Sunday',
        unit_number: null,
        occurred_at: '2026-11-19T10:00:00Z',
      },
      {
        id: 'b4d55fc3-0751-4b79-86c1-5b3e25942392',
        kind: 'registration',
        title: null,
        unit_number: null,
        occurred_at: '2026-11-18T09:00:00Z',
      },
    ],
  },
};
const sampleActions: AdminActionsFeed = {
  status: 'ok',
  items: [
    {
      id: '2',
      action: 'billing.payment.confirm',
      actor_role: 'admin',
      created_at: '2026-11-20T06:00:00Z',
    },
    {
      id: '1',
      action: 'notice.publish',
      actor_role: 'committee',
      created_at: '2026-11-19T10:00:00Z',
    },
  ],
};
const unavailable = { status: 'unavailable' } as const;

function Fixture() {
  const params = useSearchParams();
  const state = params.get('state');
  const committee = state === 'committee';
  let snapshot: AdminHomeSnapshot = sample;
  let actions: AdminActionsFeed = committee ? null : sampleActions;
  if (state === 'unavailable') {
    snapshot = {
      ...sample,
      requests: unavailable,
      billing: unavailable,
      meeting: unavailable,
      activity: unavailable,
    };
    actions = unavailable;
  } else if (state === 'empty') {
    snapshot = {
      ...sample,
      visitors: null,
      amc: null,
      stock: null,
      tenancy: null,
      meeting: { status: 'ok', next: null },
      activity: { status: 'ok', items: [] },
    };
    actions = { status: 'ok', items: [] };
  }
  const Shell = committee ? CommitteeShell : AdminShell;

  return (
    <LanguageProvider
      initialLocale={params.get('locale') === 'hi' ? 'hi' : 'en'}
      mode="device"
    >
      <Shell enabledModules={enabledModules}>
        <div className="grid gap-space-5">
          <Banner tone="info">
            Synthetic dashboard preview; no real society data.
          </Banner>
          {state === 'loading' ? (
            <Skeleton label="Loading dashboard" rows={8} />
          ) : (
            <AdminHome
              actions={actions}
              snapshot={snapshot}
              suspended={state === 'suspended'}
            />
          )}
        </div>
      </Shell>
    </LanguageProvider>
  );
}

export default function AdminHomeFixture() {
  return (
    <Suspense fallback={null}>
      <Fixture />
    </Suspense>
  );
}
