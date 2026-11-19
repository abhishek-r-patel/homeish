// Verify P35 toolkit validation, advisory checklist states, summaries and RPC argument mapping.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  callModuleRpc: vi.fn(),
  sendPushes: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/validated-rpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/db/validated-rpc')>()),
  callModuleRpc: mocks.callModuleRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: vi.fn(),
}));
vi.mock('../../src/core/meeting/operations', () => ({
  getMeetingAdminList: vi.fn(),
  getMeetingAdminDetail: vi.fn(),
}));
vi.mock('../../src/core/privileged/notification-delivery', () => ({
  sendNotificationPushesForRequest: mocks.sendPushes,
}));

import { HINDI_MESSAGES } from '../../src/core/i18n/messages';
import {
  saveActionTask,
  saveCapabilityAdoption,
  setActionPlanArchived,
} from '../../src/core/toolkit/operations';
import {
  ACTION_TASK_CATEGORY_LABELS,
  ACTION_TASK_STATUS_LABELS,
  ADOPTION_STATUS_LABELS,
  LINKED_ACTION_DONE_MESSAGE,
  NOT_ADDED,
  PRIORITY_LABELS,
  PROFILE_EDITABLE_FIELDS,
  PROFILE_FIELDS,
  PROFILE_FIELD_STATE_LABELS,
  PROFILE_SECTIONS,
  SOCIETY_TYPE_LABELS,
  actionPlanSummary,
  actionPlanWeeks,
  actionTaskSaveInputSchema,
  adoptionSummary,
  profileFieldState,
  societyProfileValuesSchema,
  type ActionTask,
  type CapabilityAdoption,
} from '../../src/core/toolkit/validation';

const SOCIETY = '0f4c6ac6-8a33-4a4f-8f1b-6a4e8f8f2b11';
const PLAN = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const ACTION = '8b6f2c1e-4d2a-4f3b-9c1d-2e3f4a5b6c7d';
const blankProfile = Object.fromEntries(
  PROFILE_EDITABLE_FIELDS.map((field) => [field.key, null]),
);

function taskInput(overrides: Record<string, unknown> = {}) {
  return {
    taskId: null,
    planId: PLAN,
    title: ' Review bye-laws ',
    category: 'governance',
    priority: 'high',
    ownerMembershipId: '',
    startDay: '3',
    endDay: '10',
    status: 'in_progress',
    progress: '40',
    notes: '',
    evidenceUrl: '',
    meetingActionItemId: '',
    expectedVersion: null,
    clientRequestId: ACTION,
    ...overrides,
  };
}

function task(overrides: Partial<ActionTask>): ActionTask {
  return {
    id: ACTION,
    plan_id: PLAN,
    title: 'Task',
    category: 'finance',
    priority: 'medium',
    owner_membership_id: null,
    owner_name: null,
    start_day: 1,
    end_day: 7,
    start_on: '2026-11-01',
    due_on: '2026-11-07',
    days_left: 0,
    status: 'not_started',
    progress: 0,
    timeline: 'on_track',
    notes: null,
    evidence_url: null,
    meeting_action: null,
    version: 1,
    updated_at: '2026-11-01T00:00:00Z',
    updated_by_name: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildRequestContext.mockResolvedValue({
    societyId: SOCIETY,
    userId: 'user-1',
    requestId: 'request-1',
    roles: ['admin'],
  });
});

describe('society profile validation', () => {
  it('normalises references, blanks empty values and rejects malformed ones', () => {
    const values = societyProfileValuesSchema.parse({
      ...blankProfile,
      pan: ' abcde 1234f ',
      ifsc: 'sbin0001234',
      chairman_mobile: '98765 43210',
      state: '   ',
      pin_code: '400001',
    });
    expect(values).toMatchObject({
      pan: 'ABCDE1234F',
      ifsc: 'SBIN0001234',
      chairman_mobile: '9876543210',
      state: null,
      pin_code: '400001',
    });
    expect(
      societyProfileValuesSchema.safeParse({
        ...blankProfile,
        pin_code: '0123',
      }).success,
    ).toBe(false);
    expect(
      societyProfileValuesSchema.safeParse({ ...blankProfile, extra: 'x' })
        .success,
    ).toBe(false);
  });

  it('marks co-operative-only fields as not applicable for other society types', () => {
    expect(profileFieldState('auditor_name', { society_type: 'other' })).toBe(
      'not_applicable',
    );
    expect(
      profileFieldState('auditor_name', {
        society_type: 'cooperative_housing_society',
      }),
    ).toBe('missing');
    expect(profileFieldState('state', {})).toBe('missing');
    expect(profileFieldState('parking_count', {})).toBe('optional');
    expect(profileFieldState('parking_count', { parking_count: 0 })).toBe(
      'filled',
    );
  });
});

describe('action plan validation and summaries', () => {
  it('rejects completing a task that is linked to a meeting action', () => {
    const result = actionTaskSaveInputSchema.safeParse(
      taskInput({ status: 'done', meetingActionItemId: ACTION }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(LINKED_ACTION_DONE_MESSAGE);
  });

  it('requires the end day on or after the start day and coerces numbers', () => {
    expect(
      actionTaskSaveInputSchema.safeParse(
        taskInput({ startDay: '9', endDay: '3' }),
      ).success,
    ).toBe(false);
    expect(actionTaskSaveInputSchema.parse(taskInput())).toMatchObject({
      title: 'Review bye-laws',
      startDay: 3,
      endDay: 10,
      progress: 40,
      ownerMembershipId: null,
      meetingActionItemId: null,
    });
  });

  it('summarises tasks and groups them by due week', () => {
    const tasks = [
      task({ status: 'done', progress: 100, timeline: 'done', end_day: 3 }),
      task({
        priority: 'high',
        timeline: 'overdue',
        due_on: '2026-11-05',
        end_day: 5,
      }),
      task({
        status: 'in_progress',
        progress: 50,
        due_on: '2026-11-15',
        end_day: 15,
      }),
    ];
    expect(actionPlanSummary(tasks, '2026-11-10')).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      overdue: 1,
      highPriorityOpen: 1,
      progressPercent: 50,
      nextSevenDays: 1,
    });
    expect(
      actionPlanWeeks({ start_on: '2026-11-01', tasks }).map((week) => [
        week.week,
        week.from,
        week.to,
        week.tasks.length,
      ]),
    ).toEqual([
      [1, '2026-11-01', '2026-11-07', 2],
      [3, '2026-11-15', '2026-11-21', 1],
    ]);
  });

  it('counts adoption summaries with review dates due today', () => {
    const base = {
      module_name: 'Module',
      enabled: true,
      owner_membership_id: null,
      owner_name: null,
      notes: null,
      version: 1,
      updated_at: null,
      updated_by_name: null,
    };
    const capabilities = [
      {
        ...base,
        module_key: 'a',
        status: 'in_use',
        priority: 'low',
        review_on: '2026-11-10',
      },
      {
        ...base,
        module_key: 'b',
        status: 'mastered',
        priority: 'low',
        review_on: null,
      },
      {
        ...base,
        module_key: 'c',
        status: 'exploring',
        priority: 'high',
        review_on: '2026-12-01',
      },
      {
        ...base,
        module_key: 'd',
        status: 'not_started',
        priority: 'high',
        review_on: null,
      },
    ] as unknown as CapabilityAdoption[];
    expect(adoptionSummary(capabilities, '2026-11-10')).toEqual({
      inUse: 2,
      exploring: 1,
      reviewPending: 1,
      highPriorityNotStarted: 1,
    });
  });
});

describe('toolkit operations', () => {
  it('maps adoption input to the save contract', async () => {
    mocks.callModuleRpc.mockResolvedValue({ version: 2 });
    await saveCapabilityAdoption(
      {
        moduleKey: 'billing',
        status: 'exploring',
        priority: 'high',
        ownerMembershipId: '',
        reviewOn: '2026-12-01',
        notes: ' Try online payments ',
        expectedVersion: null,
      },
      'request-1',
    );
    expect(mocks.callModuleRpc.mock.calls[0]?.[1]).toBe(
      'society_capability_adoption_save',
    );
    expect(mocks.callModuleRpc.mock.calls[0]?.[2]).toEqual({
      p_society_id: SOCIETY,
      p_module_key: 'billing',
      p_status: 'exploring',
      p_priority: 'high',
      p_owner_membership_id: null,
      p_review_on: '2026-12-01',
      p_notes: 'Try online payments',
      p_expected_version: null,
      p_request_id: 'request-1',
    });
  });

  it('saves a task, then delivers any owner notification push', async () => {
    mocks.callModuleRpc.mockResolvedValue(ACTION);
    await saveActionTask(taskInput(), 'request-1');
    expect(mocks.callModuleRpc.mock.calls[0]?.[2]).toMatchObject({
      p_plan_id: PLAN,
      p_task_id: null,
      p_start_day: 3,
      p_end_day: 10,
      p_progress: 40,
      p_client_request_id: ACTION,
    });
    expect(mocks.sendPushes).toHaveBeenCalledWith('request-1');
  });

  it('returns the requested archive state', async () => {
    mocks.callModuleRpc.mockResolvedValue(null);
    await expect(
      setActionPlanArchived(
        { planId: PLAN, archived: false, expectedVersion: 3 },
        'request-1',
      ),
    ).resolves.toBe(false);
  });
});

describe('toolkit Hindi labels', () => {
  it('translates every label rendered through a variable', () => {
    const labels = [
      NOT_ADDED,
      LINKED_ACTION_DONE_MESSAGE,
      ...PROFILE_SECTIONS.map((section) => section.label),
      ...PROFILE_FIELDS.flatMap((field) =>
        field.help ? [field.label, field.help] : [field.label],
      ),
      ...Object.values(SOCIETY_TYPE_LABELS),
      ...Object.values(PROFILE_FIELD_STATE_LABELS),
      ...Object.values(ADOPTION_STATUS_LABELS),
      ...Object.values(PRIORITY_LABELS),
      ...Object.values(ACTION_TASK_CATEGORY_LABELS),
      ...Object.values(ACTION_TASK_STATUS_LABELS),
      'Done',
      'Overdue',
      'Upcoming',
      'On track',
      'Tasks',
      'Weekly timeline',
    ];
    expect(
      labels.filter((label) => !Object.hasOwn(HINDI_MESSAGES, label)),
    ).toEqual([]);
  });
});
