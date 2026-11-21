// Exercise the P43.2 monthly collection, P43.3 dues follow-up and P43.5 meeting summary views with synthetic data.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/app-shells';
import {
  DuesFollowUpPanel,
  MonthlyCollectionPanel,
} from '@/components/billing/collection-reports';
import { LanguageProvider } from '@/components/language-provider';
import { MeetingSummaryView } from '@/components/meeting/summary';
import { Banner } from '@/components/ui/feedback';
import type { ReportPeriod } from '@/core/analytics/report-period';
import type {
  BillingDuesFollowUp,
  BillingMonthlyCollection,
} from '@/core/billing/collection-validation';
import type { MeetingGovernanceSummary } from '@/core/meeting/summary-validation';
import type { ModuleKey } from '@/core/modules';

const enabledModules: ModuleKey[] = ['core', 'billing', 'meeting'];
const periodHrefs: Record<ReportPeriod, string> = {
  '6m': '/fixtures/admin-reports?view=collection&period=6m',
  '12m': '/fixtures/admin-reports?view=collection&period=12m',
  fy: '/fixtures/admin-reports?view=collection&period=fy',
};

const collection: BillingMonthlyCollection = {
  today: '2026-11-20',
  rows: [
    {
      month: '2026-10-01',
      bill_count: 40,
      billed_paise: '10000000',
      waived_paise: '500000',
      net_billed_paise: '9500000',
      collected_paise: '9000000',
      collection_percent: 94.7,
    },
    {
      month: '2026-11-01',
      bill_count: 0,
      billed_paise: '0',
      waived_paise: '0',
      net_billed_paise: '0',
      collected_paise: '0',
      collection_percent: null,
    },
  ],
};

const followUp: BillingDuesFollowUp = {
  today: '2026-11-20',
  rows: [
    {
      unit_id: '4b1f6a0e-4b9f-4d3c-9a51-1f8e2c7d0a01',
      unit_number: 'A-101',
      name: 'Asha Rao',
      relationship: 'owner',
      phone: '+919800000001',
      email: 'asha@example.test',
      outstanding_paise: '1250000',
      oldest_due_date: '2026-08-10',
      months_overdue: 3,
      last_payment_on: '2026-07-05',
      last_payment_paise: '500000',
      awaiting_confirmation: true,
    },
    {
      unit_id: '4b1f6a0e-4b9f-4d3c-9a51-1f8e2c7d0a02',
      unit_number: 'B-204',
      name: null,
      relationship: null,
      phone: null,
      email: null,
      outstanding_paise: '250000',
      oldest_due_date: '2026-11-10',
      months_overdue: 1,
      last_payment_on: null,
      last_payment_paise: null,
      awaiting_confirmation: false,
    },
  ],
};

const meeting: MeetingGovernanceSummary = {
  today: '2026-11-20',
  from: '2025-12-01',
  to: '2026-11-30',
  meetings: { scheduled: 1, held: 6, cancelled: 1 },
  quorum: { with_rule: 5, met: 4 },
  average_attendance_percent: 62.5,
  resolutions: { passed: 9, failed: 1, deferred: 2, pending: 1 },
  actions: { open: 5, overdue: 2, done: 11 },
  minutes_unpublished: 1,
  owners: [
    { owner_name: 'Ravi Shah', open: 1, overdue: 2, next_due_on: '2026-10-01' },
    {
      owner_name: 'Meera Iyer',
      open: 2,
      overdue: 0,
      next_due_on: '2026-12-05',
    },
  ],
};

function Fixture() {
  const params = useSearchParams();
  const view = params.get('view');
  const empty = params.get('state') === 'empty';
  let content;
  if (view === 'follow-up') {
    content = (
      <DuesFollowUpPanel
        report={empty ? { ...followUp, rows: [] } : followUp}
      />
    );
  } else if (view === 'meeting') {
    content = (
      <MeetingSummaryView
        summary={{
          ...meeting,
          ...(empty ? { owners: [], average_attendance_percent: null } : {}),
          period: '12m',
        }}
      />
    );
  } else {
    content = (
      <MonthlyCollectionPanel
        canExport={params.get('state') !== 'committee'}
        periodHrefs={periodHrefs}
        report={{ ...collection, period: '12m' }}
      />
    );
  }

  return (
    <LanguageProvider
      initialLocale={params.get('locale') === 'hi' ? 'hi' : 'en'}
      mode="device"
    >
      <AdminShell enabledModules={enabledModules}>
        <div className="grid gap-space-5">
          <Banner tone="info">
            Synthetic report preview; no real society data.
          </Banner>
          {content}
        </div>
      </AdminShell>
    </LanguageProvider>
  );
}

export default function AdminReportsFixture() {
  return (
    <Suspense fallback={null}>
      <Fixture />
    </Suspense>
  );
}
