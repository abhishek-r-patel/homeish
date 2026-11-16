// Exercise Utility Metering screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  meteringBillingRunInputSchema,
  meteringMeterInputSchema,
  meteringRateInputSchema,
  meteringReadingInputSchema,
  meteringReviewInputSchema,
  type MeteringAdminMeter,
  type MeteringAdminWorkspace,
  type MeteringGuardBoard,
  type MeteringMeter,
  type MeteringResidentWorkspace,
} from '@/core/metering/validation';
import { MeteringAdminView } from '@/components/metering/admin';
import { MeteringGuardView } from '@/components/metering/guard';
import { MeteringResidentView } from '@/components/metering/resident';
import {
  MeteringRouteState,
  type MeteringActions,
  type MeteringRouteStateKind,
} from '@/components/metering/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const USER_ID = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_A = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_B = 'd1d55fc3-0751-4b79-86c1-5b3e25942392';
const WATER_A = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const POWER_A = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';
const WATER_B = 'a2d55fc3-0751-4b79-86c1-5b3e25942392';
const CLUB_DG = 'a3d55fc3-0751-4b79-86c1-5b3e25942392';
const TODAY = '2026-11-16';
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const PHOTO_PATH = `${SOCIETY_ID}/readings/${USER_ID}/e0d55fc3-0751-4b79-86c1-5b3e25942392.jpg`;

const roleSchema = z.enum(['resident', 'admin', 'committee', 'guard']);
type FixtureRole = z.infer<typeof roleSchema>;
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
] as const satisfies readonly MeteringRouteStateKind[];
const scenarioSchema = z.enum([
  'ready',
  'empty',
  'billing_off',
  ...ROUTE_STATES,
]);
type Scenario = z.infer<typeof scenarioSchema>;

const UNITS = [
  { id: UNIT_A, number: 'A-101' },
  { id: UNIT_B, number: 'B-204' },
];
const METERS: MeteringMeter[] = [
  {
    id: WATER_A,
    meter_type: 'water',
    scope: 'unit',
    unit_id: UNIT_A,
    unit_number: 'A-101',
    label: 'A-101 water',
    serial_number: 'WM-55120',
    active: true,
    last_reading_value: '1240.500',
    last_reading_date: '2026-10-31',
    base_value: '1240.500',
    has_pending: true,
  },
  {
    id: POWER_A,
    meter_type: 'electricity',
    scope: 'unit',
    unit_id: UNIT_A,
    unit_number: 'A-101',
    label: 'A-101 power',
    serial_number: null,
    active: true,
    last_reading_value: '8840',
    last_reading_date: '2026-10-31',
    base_value: '8840',
    has_pending: false,
  },
  {
    id: WATER_B,
    meter_type: 'water',
    scope: 'unit',
    unit_id: UNIT_B,
    unit_number: 'B-204',
    label: 'B-204 water',
    serial_number: null,
    active: true,
    last_reading_value: '310',
    last_reading_date: '2026-10-31',
    base_value: '310',
    has_pending: false,
  },
  {
    id: CLUB_DG,
    meter_type: 'dg',
    scope: 'common',
    unit_id: null,
    unit_number: null,
    label: 'Clubhouse DG',
    serial_number: 'DG-9',
    active: true,
    last_reading_value: null,
    last_reading_date: null,
    base_value: '52.250',
    has_pending: false,
  },
];
const RATES = [
  {
    meter_type: 'water' as const,
    rate_paise: 850,
    set_at: '2026-09-01T05:00:00Z',
  },
  {
    meter_type: 'electricity' as const,
    rate_paise: 725,
    set_at: '2026-09-01T05:00:00Z',
  },
];
const MONTHS = [
  '2026-03-01',
  '2026-04-01',
  '2026-05-01',
  '2026-06-01',
  '2026-07-01',
  '2026-08-01',
  '2026-09-01',
  '2026-10-01',
  '2026-11-01',
];

function periods(values: (string | null)[], resetAt = -1) {
  return MONTHS.map((month, index) => ({
    month,
    consumption: values[index] ?? '0',
    readings: values[index] === null ? 0 : 1,
    resets: index === resetAt ? 1 : 0,
  }));
}

function residentWorkspace(scenario: Scenario): MeteringResidentWorkspace {
  const empty = scenario === 'empty';
  return {
    billing_enabled: scenario !== 'billing_off',
    today: TODAY,
    units: empty ? [] : [UNITS[0]!],
    rates: RATES,
    meters: empty ? [] : METERS.slice(0, 2),
    readings: empty
      ? []
      : [
          {
            id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_id: WATER_A,
            meter_label: 'A-101 water',
            meter_type: 'water',
            reading_value: '1262.750',
            reading_date: '2026-11-15',
            status: 'pending',
            source: 'resident',
            consumption: null,
            is_reset: false,
            lower_reason: null,
            rejection_reason: null,
            photo_path: PHOTO_PATH,
            is_mine: true,
            created_at: '2026-11-15T04:00:00Z',
            charge_status: null,
            charge_amount_paise: null,
            bill_id: null,
          },
          {
            id: 'f1d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_id: WATER_A,
            meter_label: 'A-101 water',
            meter_type: 'water',
            reading_value: '1240.500',
            reading_date: '2026-10-31',
            status: 'approved',
            source: 'guard',
            consumption: '18.250',
            is_reset: false,
            lower_reason: null,
            rejection_reason: null,
            photo_path: null,
            is_mine: false,
            created_at: '2026-10-31T05:00:00Z',
            charge_status: 'billed',
            charge_amount_paise: 15513,
            bill_id: 'f2d55fc3-0751-4b79-86c1-5b3e25942392',
          },
          {
            id: 'f3d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_id: POWER_A,
            meter_label: 'A-101 power',
            meter_type: 'electricity',
            reading_value: '8800',
            reading_date: '2026-10-30',
            status: 'rejected',
            source: 'resident',
            consumption: null,
            is_reset: false,
            lower_reason: null,
            rejection_reason: 'The photo is blurred. Please retake it.',
            photo_path: PHOTO_PATH,
            is_mine: true,
            created_at: '2026-10-30T05:00:00Z',
            charge_status: null,
            charge_amount_paise: null,
            bill_id: null,
          },
        ],
  };
}

function adminMeters(): MeteringAdminMeter[] {
  return METERS.map((meter, index) => ({
    ...meter,
    initial_reading: index === 3 ? '52.250' : '0',
    version: 1,
    has_readings: index !== 3,
  })).concat({
    ...METERS[1]!,
    id: 'aad55fc3-0751-4b79-86c1-5b3e25942392',
    label: 'Old A-101 power',
    active: false,
    has_pending: false,
    initial_reading: '0',
    version: 2,
    has_readings: true,
  });
}

function adminWorkspace(
  scenario: Scenario,
  canManage: boolean,
): MeteringAdminWorkspace {
  const empty = scenario === 'empty';
  return {
    can_manage: canManage,
    billing_enabled: scenario !== 'billing_off',
    today: TODAY,
    units: UNITS,
    meters: empty ? [] : adminMeters(),
    rates: empty ? [] : RATES,
    rate_history: empty
      ? []
      : [
          ...RATES.map((rate, index) => ({
            ...rate,
            id: `b${index}d55fc3-0751-4b79-86c1-5b3e25942392`,
          })),
          {
            id: 'b9d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_type: 'water',
            rate_paise: 800,
            set_at: '2026-04-01T05:00:00Z',
          },
        ],
    queue: empty
      ? []
      : [
          {
            id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_id: WATER_A,
            meter_label: 'A-101 water',
            meter_type: 'water',
            unit_number: 'A-101',
            reading_value: '1262.750',
            reading_date: '2026-11-15',
            base_value: '1240.500',
            lower_reason: null,
            photo_path: PHOTO_PATH,
            submitted_by: 'Asha Rao',
            created_at: '2026-11-15T04:00:00Z',
          },
          {
            id: 'f4d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_id: WATER_B,
            meter_label: 'B-204 water',
            meter_type: 'water',
            unit_number: 'B-204',
            reading_value: '12',
            reading_date: '2026-11-14',
            base_value: '310',
            lower_reason: 'The meter was replaced on 12 November.',
            photo_path: PHOTO_PATH,
            submitted_by: 'Vikram Shah',
            created_at: '2026-11-14T04:00:00Z',
          },
        ],
    recent: empty
      ? []
      : [
          {
            id: 'f1d55fc3-0751-4b79-86c1-5b3e25942392',
            meter_id: WATER_A,
            meter_label: 'A-101 water',
            meter_type: 'water',
            unit_number: 'A-101',
            reading_value: '1240.500',
            reading_date: '2026-10-31',
            status: 'approved',
            source: 'guard',
            consumption: '18.250',
            is_reset: false,
            lower_reason: null,
            rejection_reason: null,
            photo_path: null,
            created_at: '2026-10-31T05:00:00Z',
            charge_status: 'billed',
            charge_amount_paise: 15513,
          },
        ],
    charges: {
      pending_count: empty ? 0 : 3,
      pending_without_rate: empty ? 0 : 1,
      billed_count: empty ? 0 : 12,
      no_charge_count: empty ? 0 : 1,
      billed_paise: empty ? 0 : 184250,
      last_billed_at: empty ? null : '2026-11-01T04:30:00Z',
    },
    report: {
      months: MONTHS,
      meters: empty
        ? []
        : [
            {
              meter_id: WATER_A,
              label: 'A-101 water',
              meter_type: 'water',
              scope: 'unit',
              unit_number: 'A-101',
              unit_occupied: true,
              periods: periods([
                null,
                '16',
                '17.5',
                '15',
                '18',
                '16.5',
                '17',
                '41.250',
                null,
              ]),
            },
            {
              meter_id: WATER_B,
              label: 'B-204 water',
              meter_type: 'water',
              scope: 'unit',
              unit_number: 'B-204',
              unit_occupied: true,
              periods: periods(
                [null, null, '9', '10', '8', '0', '11', '10', null],
                -1,
              ),
            },
            {
              meter_id: CLUB_DG,
              label: 'Clubhouse DG',
              meter_type: 'dg',
              scope: 'common',
              unit_number: null,
              unit_occupied: false,
              periods: periods([
                null,
                null,
                null,
                null,
                '0',
                '3',
                '2',
                '4',
                null,
              ]),
            },
          ],
    },
  };
}

function guardBoard(scenario: Scenario, query: string): MeteringGuardBoard {
  const term = query.trim().toLowerCase();
  return {
    query: term || null,
    today: TODAY,
    meters:
      scenario === 'empty'
        ? []
        : METERS.filter(
            (meter) =>
              !term ||
              meter.label.toLowerCase().includes(term) ||
              (meter.unit_number ?? '').toLowerCase().includes(term),
          ),
    recent:
      scenario === 'empty'
        ? []
        : [
            {
              id: 'f1d55fc3-0751-4b79-86c1-5b3e25942392',
              meter_label: 'A-101 water',
              meter_type: 'water',
              unit_number: 'A-101',
              reading_value: '1240.500',
              reading_date: '2026-10-31',
              consumption: '18.250',
              is_reset: false,
              created_at: '2026-10-31T05:00:00Z',
            },
          ],
  };
}

const requestFiles: typeof fetch = async (resource, options) => {
  const url = new URL(
    resource instanceof Request ? resource.url : String(resource),
    window.location.origin,
  );
  if (url.pathname === '/api/files/upload-url') {
    const body = z
      .object({ contentType: z.enum(['image/jpeg', 'image/png']) })
      .parse(JSON.parse(z.string().parse(options?.body)));
    const path = `${SOCIETY_ID}/readings/${USER_ID}/${crypto.randomUUID()}.${body.contentType === 'image/png' ? 'png' : 'jpg'}`;
    return Response.json({
      ok: true,
      data: {
        path,
        signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/metering-photos/${path}?token=synthetic`,
      },
    });
  }
  if (url.pathname === '/api/files/url') {
    const body = z
      .object({ path: z.string() })
      .parse(JSON.parse(z.string().parse(options?.body)));
    return Response.json({
      ok: true,
      data: {
        signedUrl: `${STORAGE_BASE}/storage/v1/object/sign/metering-photos/${body.path}?token=synthetic`,
        expiresIn: 300,
      },
    });
  }
  return new Response(null, { status: 200 });
};

function stub(
  schema: z.ZodType,
  message: string,
): (data: FormData) => Promise<ServerActionResult<unknown>> {
  return async (data) => {
    const raw = data.get('input');
    const parsed = schema.safeParse(
      typeof raw === 'string' ? JSON.parse(raw) : null,
    );
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0]?.message ?? 'Check the form.',
      };
    return { ok: true, message: `${message} (synthetic, nothing saved)` };
  };
}

const ACTIONS: MeteringActions = {
  saveMeter: stub(meteringMeterInputSchema, 'Meter saved.'),
  setRate: stub(meteringRateInputSchema, 'Rate saved.'),
  record: stub(meteringReadingInputSchema, 'Reading saved.'),
  submit: stub(meteringReadingInputSchema, 'Reading sent.'),
  review: stub(meteringReviewInputSchema, 'Review saved.'),
  runBilling: stub(meteringBillingRunInputSchema, 'Usage added to bills.'),
};

export default function MeteringFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('ready');
  const [query, setQuery] = useState('');
  const routeState = ROUTE_STATES.find((state) => state === scenario);

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic metering fixture" tone="info">
          Development-only meters, readings and usage with injected actions. No
          hosted Auth, database writes, uploads or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setRole(roleSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="fixture-scenario"
            label="Fixture scenario"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <MeteringRouteState
            kind={routeState}
            returnHref="/fixtures/metering"
            retryHref={
              routeState === 'error' ? '/fixtures/metering' : undefined
            }
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : role === 'resident' ? (
          <MeteringResidentView
            workspace={residentWorkspace(scenario)}
            actions={ACTIONS}
            fileRequest={requestFiles}
          />
        ) : role === 'guard' ? (
          <MeteringGuardView
            board={guardBoard(scenario, query)}
            baseHref="/fixtures/metering"
            actions={ACTIONS}
            fileRequest={requestFiles}
            onSearch={setQuery}
          />
        ) : (
          <MeteringAdminView
            workspace={adminWorkspace(scenario, role === 'admin')}
            actions={ACTIONS}
            fileRequest={requestFiles}
          />
        )}
      </main>
    </>
  );
}
