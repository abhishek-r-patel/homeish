// Exercise Parking screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  parkingAllocateInputSchema,
  parkingAllocationEndInputSchema,
  parkingPassCancelInputSchema,
  parkingPassInputSchema,
  parkingReportInputSchema,
  parkingReportResolveInputSchema,
  parkingRequestCancelInputSchema,
  parkingRequestInputSchema,
  parkingSettingsInputSchema,
  parkingSlotArchiveInputSchema,
  parkingSlotInputSchema,
  parkingVehicleLinkInputSchema,
  type ParkingAdminWorkspace,
  type ParkingAllocation,
  type ParkingGuardBoard,
  type ParkingPass,
  type ParkingReport,
  type ParkingResidentWorkspace,
} from '@/core/parking/validation';
import { ParkingAdminView } from '@/components/parking/admin';
import { ParkingGuardView } from '@/components/parking/guard';
import { ParkingResidentView } from '@/components/parking/resident';
import {
  ParkingRouteState,
  type ParkingActions,
  type ParkingRouteStateKind,
} from '@/components/parking/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const USER_ID = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_A = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_B = 'd1d55fc3-0751-4b79-86c1-5b3e25942392';
const SLOT_CAR = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const SLOT_BIKE = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';
const SLOT_FREE = 'a2d55fc3-0751-4b79-86c1-5b3e25942392';
const SLOT_VISITOR = 'a3d55fc3-0751-4b79-86c1-5b3e25942392';
const NOW = Date.parse('2026-11-16T09:00:00Z');
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const PHOTO_PATH = `${SOCIETY_ID}/reports/${USER_ID}/e0d55fc3-0751-4b79-86c1-5b3e25942392.jpg`;

const roleSchema = z.enum(['resident', 'admin', 'committee', 'guard']);
type FixtureRole = z.infer<typeof roleSchema>;
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
] as const satisfies readonly ParkingRouteStateKind[];
const scenarioSchema = z.enum([
  'ready',
  'empty',
  'directory_off',
  'visitor_off',
  ...ROUTE_STATES,
]);
type Scenario = z.infer<typeof scenarioSchema>;

const ALLOCATION: ParkingAllocation = {
  id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
  slot_id: SLOT_CAR,
  slot_label: 'B1-14',
  slot_type: 'car',
  location_note: 'Basement 1, near lift B',
  unit_id: UNIT_A,
  unit_number: 'A-101',
  started_at: '2026-10-01T05:00:00Z',
  skip_reason: null,
  vehicles: [
    {
      vehicle_id: 'f1d55fc3-0751-4b79-86c1-5b3e25942392',
      registration_number: 'MH01AB1234',
      vehicle_type: 'car',
      linked: true,
      linked_elsewhere: false,
    },
    {
      vehicle_id: 'f2d55fc3-0751-4b79-86c1-5b3e25942392',
      registration_number: 'MH01CD5678',
      vehicle_type: 'two_wheeler',
      linked: false,
      linked_elsewhere: false,
    },
  ],
};
const BIKE_ALLOCATION: ParkingAllocation = {
  ...ALLOCATION,
  id: 'f3d55fc3-0751-4b79-86c1-5b3e25942392',
  slot_id: SLOT_BIKE,
  slot_label: 'TW-03',
  slot_type: 'two_wheeler',
  location_note: null,
  unit_id: UNIT_B,
  unit_number: 'B-204',
  skip_reason: 'Medical priority agreed by the committee.',
  vehicles: [],
};
const PASS: ParkingPass = {
  id: 'f4d55fc3-0751-4b79-86c1-5b3e25942392',
  slot_id: SLOT_VISITOR,
  slot_label: 'V-01',
  unit_id: UNIT_A,
  unit_number: 'A-101',
  visitor_name: 'Ravi Kumar',
  vehicle_number: 'KA05MN4321',
  visitor_entry_id: null,
  starts_at: '2026-11-16T08:00:00Z',
  ends_at: '2026-11-16T14:00:00Z',
  status: 'active',
};
const REPORTS: ParkingReport[] = [
  {
    id: 'f5d55fc3-0751-4b79-86c1-5b3e25942392',
    slot_id: SLOT_CAR,
    slot_label: 'B1-14',
    vehicle_number: 'DL3CAB0001',
    note: 'Unknown car in our slot since morning.',
    status: 'open',
    reporter_role: 'resident',
    matched_unit_number: 'A-101',
    photo_path: PHOTO_PATH,
    resolution_note: null,
    created_at: '2026-11-16T03:30:00Z',
    resolved_at: null,
    is_mine: true,
  },
  {
    id: 'f6d55fc3-0751-4b79-86c1-5b3e25942392',
    slot_id: null,
    slot_label: null,
    vehicle_number: 'MH01CD5678',
    note: null,
    status: 'resolved',
    reporter_role: 'guard',
    matched_unit_number: 'A-101',
    photo_path: null,
    resolution_note: 'Owner moved the scooter.',
    created_at: '2026-11-15T12:00:00Z',
    resolved_at: '2026-11-15T13:00:00Z',
    is_mine: false,
  },
];
const UNITS = [
  { id: UNIT_A, number: 'A-101' },
  { id: UNIT_B, number: 'B-204' },
];
const SLOT_CHOICES = [
  { id: SLOT_CAR, label: 'B1-14', slot_type: 'car' as const },
  { id: SLOT_BIKE, label: 'TW-03', slot_type: 'two_wheeler' as const },
  { id: SLOT_FREE, label: 'B1-15', slot_type: 'ev' as const },
];

function residentWorkspace(scenario: Scenario): ParkingResidentWorkspace {
  const empty = scenario === 'empty';
  const directory = scenario !== 'directory_off';
  return {
    directory_enabled: directory,
    visitor_enabled: scenario !== 'visitor_off',
    units: empty ? [] : [UNITS[0]!],
    allocations: empty
      ? []
      : [directory ? ALLOCATION : { ...ALLOCATION, vehicles: [] }],
    requests: empty
      ? []
      : [
          {
            id: 'f7d55fc3-0751-4b79-86c1-5b3e25942392',
            unit_id: UNIT_A,
            unit_number: 'A-101',
            slot_type: 'ev',
            note: 'We are buying an electric car next month.',
            status: 'waiting',
            created_at: '2026-11-10T06:00:00Z',
            closed_at: null,
            queue_position: 2,
          },
          {
            id: 'f8d55fc3-0751-4b79-86c1-5b3e25942392',
            unit_id: UNIT_A,
            unit_number: 'A-101',
            slot_type: 'car',
            note: null,
            status: 'fulfilled',
            created_at: '2026-09-01T06:00:00Z',
            closed_at: '2026-10-01T05:00:00Z',
            queue_position: null,
          },
        ],
    passes: empty ? [] : [PASS],
    visitor_slots: [
      { id: SLOT_VISITOR, label: 'V-01', location_note: 'Near the gate' },
    ],
    visitor_entries: empty
      ? []
      : [
          {
            id: 'f9d55fc3-0751-4b79-86c1-5b3e25942392',
            unit_id: UNIT_A,
            visitor_name: 'Ravi Kumar',
            status: 'approved',
            created_at: '2026-11-16T07:30:00Z',
          },
        ],
    report_slots: SLOT_CHOICES,
    reports: empty ? [] : REPORTS,
  };
}

function adminWorkspace(
  scenario: Scenario,
  canManage: boolean,
): ParkingAdminWorkspace {
  const empty = scenario === 'empty';
  return {
    can_manage: canManage,
    directory_enabled: scenario !== 'directory_off',
    visitor_enabled: scenario !== 'visitor_off',
    settings: { photo_retention_days: 3 },
    slots: empty
      ? []
      : [
          {
            id: SLOT_CAR,
            label: 'B1-14',
            slot_type: 'car',
            location_note: 'Basement 1, near lift B',
            archived_at: null,
            version: 3,
            allocation: ALLOCATION,
          },
          {
            id: SLOT_BIKE,
            label: 'TW-03',
            slot_type: 'two_wheeler',
            location_note: null,
            archived_at: null,
            version: 2,
            allocation: BIKE_ALLOCATION,
          },
          {
            id: SLOT_FREE,
            label: 'B1-15',
            slot_type: 'ev',
            location_note: 'Charger point 2',
            archived_at: null,
            version: 1,
            allocation: null,
          },
          {
            id: SLOT_VISITOR,
            label: 'V-01',
            slot_type: 'visitor',
            location_note: 'Near the gate',
            archived_at: null,
            version: 1,
            allocation: null,
          },
          {
            id: 'aad55fc3-0751-4b79-86c1-5b3e25942392',
            label: 'OLD-2',
            slot_type: 'car',
            location_note: null,
            archived_at: '2026-08-01T05:00:00Z',
            version: 4,
            allocation: null,
          },
        ],
    units: UNITS,
    queues: empty
      ? []
      : [
          {
            id: 'fad55fc3-0751-4b79-86c1-5b3e25942392',
            unit_id: UNIT_B,
            unit_number: 'B-204',
            slot_type: 'ev',
            note: null,
            created_at: '2026-11-02T06:00:00Z',
            queue_position: 1,
          },
          {
            id: 'f7d55fc3-0751-4b79-86c1-5b3e25942392',
            unit_id: UNIT_A,
            unit_number: 'A-101',
            slot_type: 'ev',
            note: 'We are buying an electric car next month.',
            created_at: '2026-11-10T06:00:00Z',
            queue_position: 2,
          },
        ],
    passes: empty ? [] : [PASS],
    reports: empty
      ? []
      : REPORTS.map((report) => ({ ...report, is_mine: false })),
  };
}

function guardBoard(scenario: Scenario, query: string): ParkingGuardBoard {
  const term = query.trim().toUpperCase();
  return {
    visitor_enabled: scenario !== 'visitor_off',
    passes: scenario === 'empty' ? [] : [PASS],
    slots: SLOT_CHOICES,
    query: term || null,
    matches:
      term && ('B1-14'.includes(term) || 'MH01AB1234'.includes(term))
        ? [
            {
              slot_label: 'B1-14',
              slot_type: 'car',
              unit_number: 'A-101',
              vehicle_numbers: ['MH01AB1234'],
            },
          ]
        : [],
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
    const path = `${SOCIETY_ID}/reports/${USER_ID}/${crypto.randomUUID()}.${body.contentType === 'image/png' ? 'png' : 'jpg'}`;
    return Response.json({
      ok: true,
      data: {
        path,
        signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/parking-photos/${path}?token=synthetic`,
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
        signedUrl: `${STORAGE_BASE}/storage/v1/object/sign/parking-photos/${body.path}?token=synthetic`,
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

const ACTIONS: ParkingActions = {
  saveSettings: stub(parkingSettingsInputSchema, 'Photo retention saved.'),
  saveSlot: stub(parkingSlotInputSchema, 'Slot saved.'),
  archiveSlot: stub(parkingSlotArchiveInputSchema, 'Slot archived.'),
  allocate: stub(parkingAllocateInputSchema, 'Slot allocated.'),
  endAllocation: stub(parkingAllocationEndInputSchema, 'Allocation ended.'),
  resolveReport: stub(parkingReportResolveInputSchema, 'Report resolved.'),
  createRequest: stub(parkingRequestInputSchema, 'You are on the waitlist.'),
  cancelRequest: stub(
    parkingRequestCancelInputSchema,
    'Waitlist request cancelled.',
  ),
  setVehicleLink: stub(parkingVehicleLinkInputSchema, 'Vehicle list updated.'),
  createPass: stub(parkingPassInputSchema, 'Visitor pass created.'),
  cancelPass: stub(parkingPassCancelInputSchema, 'Visitor pass cancelled.'),
  createReport: stub(parkingReportInputSchema, 'Report sent.'),
};

export default function ParkingFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('ready');
  const [query, setQuery] = useState('');
  const routeState = ROUTE_STATES.find((state) => state === scenario);

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic parking fixture" tone="info">
          Development-only slots, passes and reports with injected actions. No
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
          <ParkingRouteState
            kind={routeState}
            returnHref="/fixtures/parking"
            retryHref={routeState === 'error' ? '/fixtures/parking' : undefined}
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : role === 'resident' ? (
          <ParkingResidentView
            workspace={residentWorkspace(scenario)}
            actions={ACTIONS}
            fileRequest={requestFiles}
            now={NOW}
          />
        ) : role === 'guard' ? (
          <ParkingGuardView
            board={guardBoard(scenario, query)}
            baseHref="/fixtures/parking"
            actions={ACTIONS}
            fileRequest={requestFiles}
            onSearch={setQuery}
            now={NOW}
          />
        ) : (
          <ParkingAdminView
            workspace={adminWorkspace(scenario, role === 'admin')}
            actions={ACTIONS}
            fileRequest={requestFiles}
            now={NOW}
          />
        )}
      </main>
    </>
  );
}
