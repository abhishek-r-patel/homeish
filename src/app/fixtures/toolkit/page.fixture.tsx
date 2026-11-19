// Exercise the P35 society profile, adoption and action-plan screens with synthetic records and injected actions.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  ActionPlansWorkspace,
  MyTasksView,
  type ActionPlanActions,
} from '@/components/toolkit/action-plans';
import { AdoptionScreen } from '@/components/toolkit/adoption';
import { ToolkitRouteState } from '@/components/toolkit/shared';
import { SocietyProfileScreen } from '@/components/toolkit/society-profile';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import {
  PROFILE_FIELDS,
  PROFILE_REQUIRED_KEYS,
  actionPlanArchiveInputSchema,
  actionPlanSampleInputSchema,
  actionPlanSaveInputSchema,
  actionTaskSaveInputSchema,
  addDays,
  capabilityAdoptionSaveInputSchema,
  societyProfileSaveInputSchema,
  type ActionPlansView,
  type ActionTask,
  type CapabilityAdoptionsView,
  type SocietyProfileView,
} from '@/core/toolkit/validation';

const TODAY = '2026-11-20';
const PLAN_START = '2026-11-02';
const PLAN = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const OLD_PLAN = 'd1d55fc3-0751-4b79-86c1-5b3e25942392';
const CHAIR = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const TREASURER = 'b1d55fc3-0751-4b79-86c1-5b3e25942392';
const RESIDENT = 'b2d55fc3-0751-4b79-86c1-5b3e25942392';
const MEETING_ACTION = 'e0d55fc3-0751-4b79-86c1-5b3e25942392';

const roleSchema = z.enum(['admin', 'committee', 'resident']);
type FixtureRole = z.infer<typeof roleSchema>;
const screenSchema = z.enum(['profile', 'adoption', 'plans', 'my_tasks']);
type FixtureScreen = z.infer<typeof screenSchema>;
const scenarioSchema = z.enum([
  'normal',
  'empty',
  'loading',
  'error',
  'denied',
]);
type Scenario = z.infer<typeof scenarioSchema>;

const TITLES: Record<FixtureScreen, string> = {
  profile: 'Society profile',
  adoption: 'Adoption tracker',
  plans: 'Action plans',
  my_tasks: 'My tasks',
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

const PLAN_ACTIONS: ActionPlanActions = {
  savePlan: stub(actionPlanSaveInputSchema, 'Plan saved.'),
  setPlanArchived: stub(actionPlanArchiveInputSchema, 'Plan archived.'),
  createSamplePlan: stub(actionPlanSampleInputSchema, 'Sample plan created.'),
  saveTask: stub(actionTaskSaveInputSchema, 'Task saved.'),
};

function profile(role: FixtureRole, scenario: Scenario): SocietyProfileView {
  const empty = scenario === 'empty';
  const values: Record<string, string | number | null> = empty
    ? {}
    : {
        society_type: 'cooperative_housing_society',
        registration_number: 'MUM/HSG/TC/12345/2001',
        registration_date: '2001-04-12',
        registration_authority: 'Deputy Registrar, Co-operative Societies',
        state: 'Maharashtra',
        pin_code: '400001',
        financial_year_start_month: 4,
        committee_size: 7,
        parking_count: 48,
        chairman_name: 'Asha Kulkarni',
        bank_name: 'Example Co-operative Bank',
        pan: 'ABCDE1234F',
        ifsc: 'SBIN0001234',
        chairman_mobile: '9876543210',
      };
  const visible = Object.fromEntries(
    Object.entries(values).filter(
      ([key]) =>
        role === 'admin' ||
        !PROFILE_FIELDS.find((field) => field.key === key)?.restricted,
    ),
  );
  const society = {
    name: 'Synthetic Heights CHS',
    address: empty ? null : '12 Example Road',
    city: 'Mumbai',
    contact_email: empty ? null : 'office@example.test',
    contact_phone: null,
  };
  const all = { ...society, ...values } as Record<string, unknown>;
  const required = [...PROFILE_REQUIRED_KEYS] as string[];
  const missing = required.filter(
    (key) => all[key] === null || all[key] === undefined,
  );
  return {
    society,
    profile: visible,
    restricted_visible: role === 'admin',
    can_manage: role === 'admin',
    version: empty ? null : 3,
    updated_at: empty ? null : '2026-11-18T10:00:00Z',
    updated_by_name: empty ? null : 'Asha Kulkarni',
    completeness: {
      required_fields: required,
      missing_fields: missing,
      required_count: required.length,
      filled_count: required.length - missing.length,
    },
  };
}

function adoptions(
  role: FixtureRole,
  scenario: Scenario,
): CapabilityAdoptionsView {
  const base = {
    owner_membership_id: null,
    owner_name: null,
    review_on: null,
    notes: null,
    version: null,
    updated_at: null,
    updated_by_name: null,
  };
  return {
    today: TODAY,
    can_manage: role === 'admin',
    capabilities:
      scenario === 'empty'
        ? []
        : [
            {
              ...base,
              module_key: 'billing',
              module_name: 'Maintenance, Fines & Payments',
              enabled: true,
              status: 'in_use',
              priority: 'high',
              owner_membership_id: TREASURER,
              owner_name: 'Ravi Shah',
              review_on: '2026-11-15',
              notes: 'Move all wings to online payment.',
              version: 2,
              updated_at: '2026-11-01T09:00:00Z',
              updated_by_name: 'Asha Kulkarni',
            },
            {
              ...base,
              module_key: 'visitor',
              module_name: 'Visitor Management',
              enabled: true,
              status: 'exploring',
              priority: 'medium',
            },
            {
              ...base,
              module_key: 'amenity',
              module_name: 'Amenity Booking',
              enabled: false,
              status: 'not_started',
              priority: 'high',
            },
          ],
  };
}

function task(
  overrides: Partial<ActionTask> & Pick<ActionTask, 'id' | 'title'>,
): ActionTask {
  const startDay = overrides.start_day ?? 1;
  const endDay = overrides.end_day ?? 7;
  const dueOn = addDays(PLAN_START, endDay - 1);
  return {
    plan_id: PLAN,
    category: 'governance',
    priority: 'medium',
    owner_membership_id: null,
    owner_name: null,
    start_day: startDay,
    end_day: endDay,
    start_on: addDays(PLAN_START, startDay - 1),
    due_on: dueOn,
    days_left: Math.round((Date.parse(dueOn) - Date.parse(TODAY)) / 86_400_000),
    status: 'not_started',
    progress: 0,
    timeline: 'on_track',
    notes: null,
    evidence_url: null,
    meeting_action: null,
    version: 1,
    updated_at: '2026-11-10T09:00:00Z',
    updated_by_name: 'Asha Kulkarni',
    ...overrides,
  };
}

const TASKS: ActionTask[] = [
  task({
    id: 'f0d55fc3-0751-4b79-86c1-5b3e25942392',
    title: 'Confirm the society profile and registration details',
    priority: 'high',
    owner_membership_id: CHAIR,
    owner_name: 'Asha Kulkarni',
    end_day: 14,
    status: 'done',
    progress: 100,
    timeline: 'done',
    evidence_url: 'https://example.test/profile-checklist',
  }),
  task({
    id: 'f1d55fc3-0751-4b79-86c1-5b3e25942392',
    title: 'Review maintenance charge heads and due dates',
    category: 'finance',
    priority: 'high',
    owner_membership_id: TREASURER,
    owner_name: 'Ravi Shah',
    start_day: 1,
    end_day: 15,
    status: 'in_progress',
    progress: 60,
    timeline: 'overdue',
  }),
  task({
    id: 'f2d55fc3-0751-4b79-86c1-5b3e25942392',
    title: 'Check fire-safety equipment and emergency contacts',
    category: 'safety',
    priority: 'high',
    owner_membership_id: RESIDENT,
    owner_name: 'Meera Iyer',
    start_day: 15,
    end_day: 23,
    status: 'in_progress',
    progress: 20,
    timeline: 'upcoming',
    meeting_action: {
      id: MEETING_ACTION,
      meeting_id: 'e1d55fc3-0751-4b79-86c1-5b3e25942392',
      title: 'Get fire extinguishers refilled',
      status: 'open',
      due_on: '2026-11-24',
    },
  }),
  task({
    id: 'f3d55fc3-0751-4b79-86c1-5b3e25942392',
    title: 'Prepare for the next annual general meeting',
    start_day: 61,
    end_day: 90,
  }),
];

function plans(role: FixtureRole, scenario: Scenario): ActionPlansView {
  const manager = role !== 'resident';
  if (scenario === 'empty')
    return { today: TODAY, can_manage: manager, plans: [] };
  const own = (tasks: ActionTask[]) =>
    manager
      ? tasks
      : tasks.filter((item) => item.owner_membership_id === RESIDENT);
  return {
    today: TODAY,
    can_manage: manager,
    plans: [
      {
        id: PLAN,
        name: 'Committee setup plan',
        start_on: PLAN_START,
        archived_at: null,
        tasks: own(TASKS),
        ...(manager
          ? {
              notes: 'First 90 days of the new committee.',
              version: 4,
              created_at: '2026-11-01T09:00:00Z',
              created_by_name: 'Asha Kulkarni',
              updated_at: '2026-11-10T09:00:00Z',
              updated_by_name: 'Asha Kulkarni',
            }
          : {}),
      },
      ...(manager
        ? [
            {
              id: OLD_PLAN,
              name: 'Monsoon readiness',
              start_on: '2026-05-01',
              archived_at: '2026-10-01T00:00:00Z',
              notes: null,
              version: 2,
              tasks: [],
            },
          ]
        : []),
    ],
  };
}

const MEMBERS = [
  { membershipId: CHAIR, label: 'Asha Kulkarni · A-101', manager: true },
  { membershipId: TREASURER, label: 'Ravi Shah · A-204', manager: true },
  { membershipId: RESIDENT, label: 'Meera Iyer · B-302', manager: false },
];
const MEETING_ACTIONS = [
  {
    id: MEETING_ACTION,
    label: 'Get fire extinguishers refilled · October committee meeting',
  },
];

export default function ToolkitFixturePage() {
  const [role, setRole] = useState<FixtureRole>('admin');
  const [screen, setScreen] = useState<FixtureScreen>('profile');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const routeState =
    scenario === 'loading' || scenario === 'error' || scenario === 'denied'
      ? scenario
      : null;

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic committee toolkit fixture" tone="info">
          Development-only society profile, adoption and action plans with
          injected actions. No hosted Auth, database writes or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-3">
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
            id="fixture-screen"
            label="Fixture screen"
            value={screen}
            options={screenSchema.options.map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            }))}
            onChange={(event) =>
              setScreen(screenSchema.parse(event.currentTarget.value))
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
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default content-start gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <ToolkitRouteState
            kind={routeState}
            title={TITLES[screen]}
            returnHref="/fixtures/toolkit"
            retryHref={routeState === 'error' ? '/fixtures/toolkit' : undefined}
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : screen === 'profile' ? (
          <SocietyProfileScreen
            key={`${role}-${scenario}`}
            view={profile(role, scenario)}
            actions={{
              saveProfile: stub(
                societyProfileSaveInputSchema,
                'Society profile saved.',
              ),
            }}
          />
        ) : screen === 'adoption' ? (
          <AdoptionScreen
            key={`${role}-${scenario}`}
            view={adoptions(role, scenario)}
            owners={MEMBERS}
            actions={{
              saveAdoption: stub(
                capabilityAdoptionSaveInputSchema,
                'Adoption saved.',
              ),
            }}
          />
        ) : screen === 'plans' ? (
          <ActionPlansWorkspace
            key={`${role}-${scenario}`}
            view={plans(role, scenario)}
            members={MEMBERS}
            meetingActions={MEETING_ACTIONS}
            actions={PLAN_ACTIONS}
            showArchived
            archivedHref="/fixtures/toolkit"
            activeHref="/fixtures/toolkit"
          />
        ) : (
          <MyTasksView
            key={`${role}-${scenario}`}
            view={plans('resident', scenario)}
          />
        )}
      </main>
    </>
  );
}
