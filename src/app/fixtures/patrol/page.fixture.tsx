// Exercise Guard Patrol screens with synthetic records and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  patrolCheckpointActiveInputSchema,
  patrolCheckpointInputSchema,
  patrolHandoverAcknowledgeInputSchema,
  patrolHandoverInputSchema,
  patrolIncidentCloseInputSchema,
  patrolIncidentInputSchema,
  patrolIncidentNoteInputSchema,
  patrolScanInputSchema,
  patrolScheduleActiveInputSchema,
  patrolScheduleInputSchema,
  patrolSettingsInputSchema,
  type PatrolAdminWorkspace,
  type PatrolCheckpoint,
  type PatrolGuardWorkspace,
  type PatrolHandover,
  type PatrolIncident,
  type PatrolScan,
  type PatrolSchedule,
} from '@/core/patrol/validation';
import { PatrolAdminView } from '@/components/patrol/admin';
import { PatrolGuardView } from '@/components/patrol/guard';
import {
  PatrolRouteState,
  type PatrolActions,
  type PatrolRouteStateKind,
} from '@/components/patrol/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const USER_ID = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const GATE = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const TERRACE = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';
const PUMP = 'a2d55fc3-0751-4b79-86c1-5b3e25942392';
const OLD = 'a3d55fc3-0751-4b79-86c1-5b3e25942392';
const NIGHT = 'e0d55fc3-0751-4b79-86c1-5b3e25942392';
const DAY = 'e1d55fc3-0751-4b79-86c1-5b3e25942392';
// 23:30 in Asia/Kolkata, inside the night shift's 22:00 round.
const GENERATED_AT = '2026-11-16T18:00:00Z';
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const PHOTO_PATH = `${SOCIETY_ID}/incidents/${USER_ID}/f0d55fc3-0751-4b79-86c1-5b3e25942392.jpg`;

const roleSchema = z.enum(['guard', 'admin', 'committee']);
type FixtureRole = z.infer<typeof roleSchema>;
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
] as const satisfies readonly PatrolRouteStateKind[];
const scenarioSchema = z.enum(['ready', 'empty', ...ROUTE_STATES]);
type Scenario = z.infer<typeof scenarioSchema>;

const CHECKPOINTS: PatrolCheckpoint[] = [
  {
    id: GATE,
    code: 'K7M2QX',
    name: 'Main gate',
    location_note: 'Left pillar, inside the guard cabin',
    active: true,
    version: 2,
    created_at: '2026-10-01T05:00:00Z',
  },
  {
    id: TERRACE,
    code: 'TB4WHR',
    name: 'Tower B terrace',
    location_note: null,
    active: true,
    version: 1,
    created_at: '2026-10-01T05:00:00Z',
  },
  {
    id: PUMP,
    code: 'PMP9RM',
    name: 'Pump room',
    location_note: 'Basement 2, behind the lift',
    active: true,
    version: 1,
    created_at: '2026-10-01T05:00:00Z',
  },
  {
    id: OLD,
    code: 'GT3HAS',
    name: 'Old back gate',
    location_note: null,
    active: false,
    version: 3,
    created_at: '2026-09-01T05:00:00Z',
  },
];

const links = (ids: string[]) =>
  ids.map((checkpoint_id) => ({
    checkpoint_id,
    included_at: '2026-10-01T05:00:00Z',
  }));

const SCHEDULES: PatrolSchedule[] = [
  {
    id: NIGHT,
    name: 'Night shift',
    shift_start: '22:00',
    shift_end: '06:00',
    interval_minutes: 120,
    grace_minutes: 15,
    active: true,
    effective_from: '2026-10-01T05:00:00Z',
    version: 2,
    checkpoints: links([GATE, TERRACE, PUMP]),
  },
  {
    id: DAY,
    name: 'Day shift',
    shift_start: '06:00',
    shift_end: '22:00',
    interval_minutes: 240,
    grace_minutes: 30,
    active: false,
    effective_from: '2026-10-01T05:00:00Z',
    version: 1,
    checkpoints: links([GATE]),
  },
];

function scan(
  id: string,
  checkpoint: string,
  at: string,
  mine: boolean,
  method: 'qr' | 'typed' = 'qr',
): PatrolScan {
  return {
    id,
    checkpoint_id: checkpoint,
    method,
    scanned_at: at,
    scanned_by_name: mine ? 'Ramesh Yadav' : 'Suresh Patil',
    is_mine: mine,
  };
}

const SCANS: PatrolScan[] = [
  scan(
    'b1d55fc3-0751-4b79-86c1-5b3e25942392',
    GATE,
    '2026-11-16T16:40:00Z',
    true,
  ),
  scan(
    'b2d55fc3-0751-4b79-86c1-5b3e25942392',
    TERRACE,
    '2026-11-16T17:05:00Z',
    true,
    'typed',
  ),
  scan(
    'b3d55fc3-0751-4b79-86c1-5b3e25942392',
    GATE,
    '2026-11-15T23:00:00Z',
    false,
  ),
  scan(
    'b4d55fc3-0751-4b79-86c1-5b3e25942392',
    PUMP,
    '2026-11-15T23:10:00Z',
    false,
  ),
];

const INCIDENTS: PatrolIncident[] = [
  {
    id: 'c1d55fc3-0751-4b79-86c1-5b3e25942392',
    category: 'suspicious_activity',
    severity: 'high',
    description: 'Side door to the pump room was found unlocked at 11 pm.',
    location: 'Pump room',
    status: 'open',
    resolution: null,
    reported_by_name: 'Ramesh Yadav',
    created_at: '2026-11-16T17:35:00Z',
    closed_at: null,
    closed_by_name: null,
    photo_paths: [PHOTO_PATH],
    notes: [
      {
        id: 'c2d55fc3-0751-4b79-86c1-5b3e25942392',
        body: 'Asked maintenance to check the lock tomorrow morning.',
        created_at: '2026-11-16T17:50:00Z',
        author_name: 'Anita Shah',
      },
    ],
  },
  {
    id: 'c3d55fc3-0751-4b79-86c1-5b3e25942392',
    category: 'property_damage',
    severity: 'low',
    description: 'Lobby light in Tower B is flickering.',
    location: null,
    status: 'closed',
    resolution: 'Electrician replaced the tube light.',
    reported_by_name: 'Suresh Patil',
    created_at: '2026-11-15T20:00:00Z',
    closed_at: '2026-11-16T06:00:00Z',
    closed_by_name: 'Anita Shah',
    photo_paths: [],
    notes: [],
  },
];

const HANDOVERS: PatrolHandover[] = [
  {
    id: 'd1d55fc3-0751-4b79-86c1-5b3e25942392',
    body: 'Water tanker expected at 7 am. Gate 2 key is with the supervisor.',
    author_name: 'Suresh Patil',
    created_at: '2026-11-16T16:25:00Z',
    acknowledged_at: null,
    acknowledged_by_name: null,
    is_mine: false,
  },
  {
    id: 'd2d55fc3-0751-4b79-86c1-5b3e25942392',
    body: 'All quiet. Visitor parking full after 9 pm.',
    author_name: 'Ramesh Yadav',
    created_at: '2026-11-16T04:30:00Z',
    acknowledged_at: '2026-11-16T05:00:00Z',
    acknowledged_by_name: 'Suresh Patil',
    is_mine: true,
  },
];

function guardWorkspace(scenario: Scenario): PatrolGuardWorkspace {
  const empty = scenario === 'empty';
  return {
    timezone: 'Asia/Kolkata',
    generated_at: GENERATED_AT,
    checkpoints: empty
      ? []
      : CHECKPOINTS.filter((checkpoint) => checkpoint.active).map(
          ({ id, name, location_note }) => ({ id, name, location_note }),
        ),
    schedules: empty ? [] : SCHEDULES.filter((schedule) => schedule.active),
    scans: empty
      ? []
      : SCANS.filter(
          (item) =>
            Date.parse(item.scanned_at) > Date.parse(GENERATED_AT) - 86_400_000,
        ),
    incidents: empty
      ? []
      : INCIDENTS.filter(
          (incident) => incident.reported_by_name === 'Ramesh Yadav',
        ).map((incident) => ({ ...incident, notes: [] })),
    handover_notes: empty ? [] : HANDOVERS,
  };
}

function adminWorkspace(
  scenario: Scenario,
  canManage: boolean,
): PatrolAdminWorkspace {
  const empty = scenario === 'empty';
  return {
    can_manage: canManage,
    timezone: 'Asia/Kolkata',
    generated_at: GENERATED_AT,
    settings: { photo_retention_days: 90 },
    checkpoints: empty ? [] : CHECKPOINTS,
    schedules: empty ? [] : SCHEDULES,
    scans: empty ? [] : SCANS,
    incidents: empty ? [] : INCIDENTS,
    handover_notes: empty
      ? []
      : HANDOVERS.map((note) => ({ ...note, is_mine: false })),
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
    const path = `${SOCIETY_ID}/incidents/${USER_ID}/${crypto.randomUUID()}.${body.contentType === 'image/png' ? 'png' : 'jpg'}`;
    return Response.json({
      ok: true,
      data: {
        path,
        signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/patrol-photos/${path}?token=synthetic`,
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
        signedUrl: `${STORAGE_BASE}/storage/v1/object/sign/patrol-photos/${body.path}?token=synthetic`,
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

const ACTIONS: PatrolActions = {
  saveSettings: stub(patrolSettingsInputSchema, 'Photo retention saved.'),
  saveCheckpoint: stub(patrolCheckpointInputSchema, 'Checkpoint saved.'),
  setCheckpointActive: stub(
    patrolCheckpointActiveInputSchema,
    'Checkpoint updated.',
  ),
  saveSchedule: stub(patrolScheduleInputSchema, 'Schedule saved.'),
  setScheduleActive: stub(patrolScheduleActiveInputSchema, 'Schedule updated.'),
  addIncidentNote: stub(patrolIncidentNoteInputSchema, 'Note added.'),
  closeIncident: stub(patrolIncidentCloseInputSchema, 'Incident closed.'),
  scan: stub(patrolScanInputSchema, 'Checkpoint recorded.'),
  createIncident: stub(patrolIncidentInputSchema, 'Incident reported.'),
  createHandover: stub(patrolHandoverInputSchema, 'Handover note saved.'),
  acknowledgeHandover: stub(
    patrolHandoverAcknowledgeInputSchema,
    'Handover note acknowledged.',
  ),
};

export default function PatrolFixturePage() {
  const [role, setRole] = useState<FixtureRole>('guard');
  const [scenario, setScenario] = useState<Scenario>('ready');
  const routeState = ROUTE_STATES.find((state) => state === scenario);

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic patrol fixture" tone="info">
          Development-only checkpoints, rounds, incidents and handover notes
          with injected actions. No hosted Auth, camera, database writes,
          uploads or notifications.
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
              label: value,
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <PatrolRouteState
            kind={routeState}
            returnHref="/fixtures/patrol"
            retryHref={routeState === 'error' ? '/fixtures/patrol' : undefined}
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : role === 'guard' ? (
          <PatrolGuardView
            workspace={guardWorkspace(scenario)}
            actions={ACTIONS}
            fileRequest={requestFiles}
          />
        ) : (
          <PatrolAdminView
            workspace={adminWorkspace(scenario, role === 'admin')}
            actions={ACTIONS}
            fileRequest={requestFiles}
          />
        )}
      </main>
    </>
  );
}
