// Exercise the resident home with synthetic data without accessing hosted services.
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResidentShell } from '@/components/app-shells';
import { ResidentHome } from '@/components/home/resident-home';
import { HomeRealtimeRefresh } from '@/components/home/realtime-refresh';
import { LanguageProvider } from '@/components/language-provider';
import { Banner } from '@/components/ui/feedback';
import type { ResidentHomeSnapshot } from '@/core/home/validation';
import { getRoleNavigation, type ModuleKey } from '@/core/modules';

const societyId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const residentId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const unitId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const sample: ResidentHomeSnapshot = {
  resident_name: 'Synthetic Resident',
  timezone: 'Asia/Kolkata',
  unit_label: 'Flat',
  units: [{ id: unitId, number: 'A-101' }],
  pending_visitors: 1,
  pending_deliveries: 2,
  server_now: '2026-11-20T08:00:00Z',
  next_response_at: '2026-11-20T08:05:00Z',
  activity: [
    {
      id: 'a1d55fc3-0751-4b79-86c1-5b3e25942392',
      module: 'visitor',
      title: 'Synthetic visitor',
      status: 'pending',
      unit_number: 'A-101',
      due_date: null,
      occurred_at: '2026-11-20T07:55:00Z',
    },
    {
      id: 'a2d55fc3-0751-4b79-86c1-5b3e25942392',
      module: 'delivery',
      title: 'Synthetic parcel',
      status: 'pending_response',
      unit_number: 'A-101',
      due_date: null,
      occurred_at: '2026-11-20T07:50:00Z',
    },
    {
      id: 'a3d55fc3-0751-4b79-86c1-5b3e25942392',
      module: 'service_request',
      title: 'Plumbing',
      status: 'in_progress',
      unit_number: 'A-101',
      due_date: null,
      occurred_at: '2026-11-19T07:00:00Z',
    },
    {
      id: 'a4d55fc3-0751-4b79-86c1-5b3e25942392',
      module: 'billing',
      title: 'Maintenance',
      status: 'due',
      unit_number: 'A-101',
      due_date: '2026-11-10',
      occurred_at: '2026-11-10T07:00:00Z',
    },
    {
      id: 'a5d55fc3-0751-4b79-86c1-5b3e25942392',
      module: 'visitor',
      title: 'Previous visitor',
      status: 'checked_out',
      unit_number: 'A-101',
      due_date: null,
      occurred_at: '2026-11-09T07:00:00Z',
    },
  ],
};

function Fixture() {
  const params = useSearchParams();
  const state = params.get('state');
  const theme = params.get('theme');
  // Preview-only switch until the app gets a real theme setting.
  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);
  const disabled = state === 'disabled';
  const empty = state === 'empty';
  const noUnit = state === 'no-unit';
  const suspended = state === 'suspended';
  const enabledModules: ModuleKey[] = disabled
    ? ['core', 'service_request']
    : ['core', 'visitor', 'delivery', 'billing', 'service_request'];
  const snapshot: ResidentHomeSnapshot = {
    ...sample,
    units: noUnit ? [] : sample.units,
    pending_visitors: disabled || empty || noUnit || suspended ? 0 : 1,
    pending_deliveries: disabled || empty || noUnit || suspended ? 0 : 2,
    activity:
      empty || noUnit
        ? []
        : sample.activity.filter((item) =>
            enabledModules.includes(item.module),
          ),
  };
  const outstanding = disabled
    ? null
    : empty || noUnit
      ? []
      : [
          {
            unit_id: unitId,
            outstanding_paise: '1250000',
            next_due_date: '2026-11-10',
          },
        ];
  const shortcuts = getRoleNavigation(['resident'], enabledModules)
    .filter((item) => item.moduleKey !== 'core')
    .map(({ href, label, moduleKey }) => ({ href, label, moduleKey }));

  return (
    <LanguageProvider
      initialLocale={params.get('locale') === 'hi' ? 'hi' : 'en'}
      mode="device"
    >
      <ResidentShell enabledModules={enabledModules}>
        <div className="grid gap-space-5">
          <Banner tone="info">
            Synthetic home preview; no real household data.
          </Banner>
          {params.get('live') === '1' ? (
            <HomeRealtimeRefresh
              deliveryEnabled={!disabled}
              nextResponseAt={null}
              serverNow={snapshot.server_now}
              societyId={societyId}
              unitIds={[unitId]}
              userId={residentId}
              visitorEnabled={!disabled}
            />
          ) : null}
          <ResidentHome
            outstanding={outstanding}
            shortcuts={shortcuts}
            snapshot={snapshot}
            suspended={suspended}
          />
        </div>
      </ResidentShell>
    </LanguageProvider>
  );
}

export default function HomeFixture() {
  return (
    <Suspense fallback={null}>
      <Fixture />
    </Suspense>
  );
}
