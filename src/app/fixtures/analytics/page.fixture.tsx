// Exercise the analytics dashboard and settings with in-memory synthetic totals, never a database.
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnalyticsDashboardView } from '@/components/analytics/dashboard';
import { AnalyticsSettingsView } from '@/components/analytics/settings';
import { AnalyticsRouteState } from '@/components/analytics/shared';
import { Button } from '@/components/ui/button';
import { Banner, ErrorPanel } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import type { ServerActionResult } from '@/core/actions/server-action';
import { ANALYTICS_METRICS } from '@/core/analytics/catalogue';
import {
  analyticsSettingsInputSchema,
  readAnalyticsRange,
  type AnalyticsDashboard,
  type AnalyticsMetric,
  type AnalyticsRange,
  type AnalyticsSettings,
} from '@/core/analytics/validation';

const TODAY = '2026-11-16';
const FY_FROM = '2026-04-01';
const BASE_PATH = '/fixtures/analytics';
const OFF_MODULES = new Set(['parking', 'sos']);

const roles = ['admin', 'committee'] as const;
type FixtureRole = (typeof roles)[number];
const screens = [
  'dashboard',
  'empty',
  'settings',
  'settings-conflict',
  'denied',
  'error',
] as const;
type FixtureScreen = (typeof screens)[number];

function monthsBack(count: number): string[] {
  const periods: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(2026, 10 - offset, 1));
    periods.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }
  return periods;
}

function startOf(period: string) {
  return `${period}-01`;
}

function buildDashboard(range: AnalyticsRange): AnalyticsDashboard {
  const periods = monthsBack(range.months);
  const fyPeriods = monthsBack(8);
  const moneyPeriods = range.money === 'fy' ? fyPeriods : periods;
  const from = startOf(periods[0] ?? '2026-11');
  const moneyFrom = range.money === 'fy' ? FY_FROM : from;
  const base = { to: TODAY, range: 'months' as const, from };
  const money = { to: TODAY, range: range.money, from: moneyFrom };
  const metrics: AnalyticsMetric[] = [
    {
      ...money,
      key: 'billing.collection_trend',
      module: 'billing',
      kind: 'trend',
      unit: 'paise',
      series: [
        { key: 'billed', label: 'Billed' },
        { key: 'collected', label: 'Collected' },
      ],
      points: moneyPeriods.map((period, index) => ({
        period,
        values: {
          billed: 1_245_000_00 + index * 3_500_00,
          collected: index === 2 ? null : 1_102_500_00 + index * 2_750_00,
        },
      })),
    },
    {
      ...base,
      from: TODAY,
      key: 'billing.dues_ageing',
      module: 'billing',
      kind: 'stat',
      unit: 'paise',
      series: [
        { key: 'not_due', label: 'Not yet due' },
        { key: 'days_0_30', label: '1–30 days late' },
        { key: 'days_31_90', label: '31–90 days late' },
        { key: 'days_over_90', label: 'Over 90 days late' },
      ],
      values: {
        not_due: 3_45_600_00,
        days_0_30: 1_23_456_00,
        days_31_90: 45_000_00,
        days_over_90: null,
      },
    },
    {
      ...base,
      key: 'service_request.sla',
      module: 'service_request',
      kind: 'trend',
      unit: 'count',
      series: [
        { key: 'within_sla', label: 'Within target' },
        { key: 'breached', label: 'Late' },
      ],
      points: periods.map((period, index) => ({
        period,
        values: { within_sla: 20 + (index % 4) * 3, breached: index % 3 },
      })),
    },
    {
      ...base,
      key: 'billing.collection_rate',
      module: 'billing',
      ...money,
      kind: 'trend',
      unit: 'percent',
      series: [{ key: 'rate', label: 'Collected on time' }],
      points: moneyPeriods.map((period, index) => ({
        period,
        values: { rate: 68.5 + index * 1.5 },
      })),
    },
    {
      ...base,
      key: 'amenity.usage',
      module: 'amenity',
      kind: 'breakdown',
      unit: 'count',
      series: [{ key: 'bookings', label: 'Bookings' }],
      items: [
        { label: 'Clubhouse hall', values: { bookings: 48 } },
        { label: 'Tennis court', values: { bookings: 31 } },
        { label: 'Guest room', values: { bookings: 9 } },
        { label: 'Other', values: { bookings: 4 } },
      ],
    },
    {
      ...base,
      key: 'home_services.ratings',
      module: 'home_services',
      kind: 'breakdown',
      unit: 'rating',
      series: [
        { key: 'average', label: 'Average rating' },
        { key: 'ratings', label: 'Ratings' },
      ],
      items: [
        { label: 'Plumbing', values: { average: 4.3, ratings: 18 } },
        { label: 'Electrical', values: { average: 3.8, ratings: 7 } },
        { label: 'Carpentry', values: { average: null, ratings: 0 } },
      ],
    },
    {
      ...base,
      from: TODAY,
      key: 'core.occupancy',
      module: 'core',
      kind: 'stat',
      unit: 'count',
      series: [
        { key: 'occupied', label: 'Occupied' },
        { key: 'vacant', label: 'Vacant' },
        { key: 'owner_occupied', label: 'Owner occupied' },
        { key: 'tenant_occupied', label: 'Tenant occupied' },
      ],
      values: {
        occupied: 412,
        vacant: 38,
        owner_occupied: 301,
        tenant_occupied: 111,
      },
    },
    {
      ...base,
      key: 'visitor.trend',
      module: 'visitor',
      kind: 'trend',
      unit: 'count',
      series: [{ key: 'entries', label: 'Visitor entries' }],
      points: [],
    },
    { ...base, key: 'notice.read_rate', module: 'notice', kind: 'unavailable' },
  ];
  return {
    today: TODAY,
    timezone: 'Asia/Kolkata',
    months: range.months,
    moneyRange: range.money,
    from,
    fyFrom: FY_FROM,
    generatedAt: '2026-11-16T09:30:00+05:30',
    metrics,
  };
}

const initialSettings: AnalyticsSettings = {
  metrics: [
    ...ANALYTICS_METRICS.filter((metric) => metric.defaultOn).map(
      (metric) => metric.key,
    ),
    'parking.occupancy',
  ],
  isDefault: false,
  version: 3,
  updatedAt: '2026-11-10T12:00:00+05:30',
  catalogue: ANALYTICS_METRICS.map((metric) => ({
    key: metric.key,
    module: metric.module,
    defaultOn: metric.defaultOn,
    money: metric.money,
    moduleEnabled: !OFF_MODULES.has(metric.module),
  })),
};

function Fixture() {
  const params = useSearchParams();
  const range = readAnalyticsRange({
    months: params.get('months'),
    money: params.get('money'),
  });
  const [role, setRole] = useState<FixtureRole>('admin');
  const router = useRouter();
  const screen: FixtureScreen =
    screens.find((value) => value === params.get('screen')) ?? 'dashboard';
  const [settings, setSettings] = useState(initialSettings);
  const isAdmin = role === 'admin';
  function setScreen(next: FixtureScreen) {
    const query = new URLSearchParams(params.toString());
    if (next === 'dashboard') query.delete('screen');
    else query.set('screen', next);
    const search = query.toString();
    router.replace(search ? `${BASE_PATH}?${search}` : BASE_PATH, {
      scroll: false,
    });
  }
  const settingsScreen =
    screen === 'settings' || screen === 'settings-conflict';

  async function saveSettings(
    form: FormData,
  ): Promise<ServerActionResult<unknown>> {
    const raw = form.get('input');
    const parsed = analyticsSettingsInputSchema.safeParse(
      typeof raw === 'string' ? JSON.parse(raw) : null,
    );
    if (!parsed.success) {
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'Choose metrics from the list and try again.',
      };
    }
    if (screen === 'settings-conflict') {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Settings changed. Reload and try again.',
      };
    }
    setSettings((current) => ({
      ...current,
      metrics: parsed.data.metrics,
      isDefault: false,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    }));
    return {
      ok: true,
      message:
        'Analytics settings saved. Synthetic fixture: nothing was saved.',
    };
  }

  const dashboard = buildDashboard(range);
  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic analytics fixture" tone="info">
          Sample society totals only. No database reads, no exports and no saved
          settings. Reload to reset.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="analytics-fixture-role"
            label="Fixture role"
            value={role}
            options={roles.map((value) => ({ value, label: value }))}
            onChange={(event) =>
              setRole(event.currentTarget.value as FixtureRole)
            }
          />
          <SelectInput
            id="analytics-fixture-screen"
            label="Fixture screen"
            value={screen}
            options={screens.map((value) => ({
              value,
              label: value.replaceAll('-', ' '),
            }))}
            onChange={(event) =>
              setScreen(event.currentTarget.value as FixtureScreen)
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full min-w-0 max-w-content-default content-start gap-space-5 px-space-4 py-space-6 text-ink">
        {screen === 'denied' || (settingsScreen && !isAdmin) ? (
          <AnalyticsRouteState
            deniedMessage={
              settingsScreen
                ? 'Only society administrators can change analytics settings.'
                : undefined
            }
            kind="denied"
            returnHref={BASE_PATH}
            returnLabel="Back to analytics"
          />
        ) : screen === 'error' ? (
          <ErrorPanel
            title="Could not load analytics"
            message="Nothing has changed. Try again in a moment."
            action={
              <Button
                onClick={() => setScreen('dashboard')}
                type="button"
                variant="secondary"
              >
                Try again
              </Button>
            }
          />
        ) : settingsScreen ? (
          <AnalyticsSettingsView
            action={saveSettings}
            dashboardHref={BASE_PATH}
            settings={settings}
          />
        ) : (
          <AnalyticsDashboardView
            basePath={BASE_PATH}
            canExport={isAdmin}
            canManage={isAdmin}
            dashboard={
              screen === 'empty' ? { ...dashboard, metrics: [] } : dashboard
            }
            settingsHref={`${BASE_PATH}?screen=settings`}
          />
        )}
      </main>
    </>
  );
}

export default function AnalyticsFixturePage() {
  return (
    <Suspense fallback={null}>
      <Fixture />
    </Suspense>
  );
}
