// Validate P35 toolkit input and read models, and derive the advisory checklist, adoption and action-plan summaries.
import { z } from 'zod';

export const NOT_ADDED = 'Not added';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
const optionalDate = z
  .union([z.literal(''), z.iso.date('Enter a valid date.'), z.null()])
  .transform((value) => value || null);
const version = z.number().int().min(1);

// Society reference profile ----------------------------------------------------

export const SOCIETY_TYPES = [
  'cooperative_housing_society',
  'apartment_association',
  'other',
] as const;
export type SocietyType = (typeof SOCIETY_TYPES)[number];
export const SOCIETY_TYPE_LABELS: Readonly<Record<SocietyType, string>> = {
  cooperative_housing_society: 'Co-operative housing society',
  apartment_association: 'Apartment association',
  other: 'Other',
};

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const PROFILE_SECTIONS = [
  { key: 'identity', label: 'Identity and registration' },
  { key: 'governance', label: 'Governance' },
  { key: 'property', label: 'Property' },
  { key: 'finance', label: 'Finance references' },
  { key: 'office_bearers', label: 'Office bearers' },
] as const;
export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number]['key'];

type ProfileFieldKind =
  'text' | 'date' | 'integer' | 'decimal' | 'society_type' | 'month';

export type ProfileField = {
  key: string;
  label: string;
  section: ProfileSectionKey;
  kind: ProfileFieldKind;
  /** Shown from the society's registered details; not saved by the profile. */
  fromSociety?: boolean;
  /** Admin-only: hidden from committee members by the database. */
  restricted?: boolean;
  max?: number;
  min?: number;
  pattern?: RegExp;
  patternMessage?: string;
  uppercase?: boolean;
  help?: string;
};

export const PROFILE_PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const PROFILE_IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PROFILE_PIN_PATTERN = /^[1-9][0-9]{5}$/;
export const PROFILE_MOBILE_PATTERN = /^\+?[0-9]{10,15}$/;

const mobile = {
  kind: 'text',
  restricted: true,
  max: 16,
  pattern: PROFILE_MOBILE_PATTERN,
  patternMessage: 'Enter a mobile number of 10 to 15 digits.',
} as const;

export const PROFILE_FIELDS: readonly ProfileField[] = [
  {
    key: 'name',
    label: 'Society name',
    section: 'identity',
    kind: 'text',
    fromSociety: true,
  },
  {
    key: 'society_type',
    label: 'Society type',
    section: 'identity',
    kind: 'society_type',
  },
  {
    key: 'registration_number',
    label: 'Registration number',
    section: 'identity',
    kind: 'text',
    max: 80,
  },
  {
    key: 'registration_date',
    label: 'Registration date',
    section: 'identity',
    kind: 'date',
  },
  {
    key: 'registration_authority',
    label: 'Registration authority',
    section: 'identity',
    kind: 'text',
    max: 200,
  },
  {
    key: 'pan',
    label: 'Society PAN',
    section: 'identity',
    kind: 'text',
    restricted: true,
    max: 10,
    uppercase: true,
    pattern: PROFILE_PAN_PATTERN,
    patternMessage: 'Enter a PAN like ABCDE1234F.',
  },
  {
    key: 'address',
    label: 'Address',
    section: 'identity',
    kind: 'text',
    fromSociety: true,
  },
  {
    key: 'city',
    label: 'City',
    section: 'identity',
    kind: 'text',
    fromSociety: true,
  },
  { key: 'state', label: 'State', section: 'identity', kind: 'text', max: 80 },
  {
    key: 'pin_code',
    label: 'PIN code',
    section: 'identity',
    kind: 'text',
    max: 6,
    pattern: PROFILE_PIN_PATTERN,
    patternMessage: 'Enter a 6-digit PIN code.',
  },
  {
    key: 'contact_email',
    label: 'Official email',
    section: 'identity',
    kind: 'text',
    fromSociety: true,
  },
  {
    key: 'contact_phone',
    label: 'Official phone',
    section: 'identity',
    kind: 'text',
    fromSociety: true,
  },
  {
    key: 'bye_laws_adopted_on',
    label: 'Bye-laws adopted on',
    section: 'governance',
    kind: 'date',
  },
  {
    key: 'committee_size',
    label: 'Committee size',
    section: 'governance',
    kind: 'integer',
    min: 1,
    max: 99,
  },
  {
    key: 'committee_term_months',
    label: 'Committee term (months)',
    section: 'governance',
    kind: 'integer',
    min: 1,
    max: 120,
  },
  {
    key: 'last_agm_on',
    label: 'Last AGM',
    section: 'governance',
    kind: 'date',
  },
  {
    key: 'last_election_on',
    label: 'Last election',
    section: 'governance',
    kind: 'date',
  },
  {
    key: 'auditor_name',
    label: 'Auditor',
    section: 'governance',
    kind: 'text',
    max: 120,
  },
  {
    key: 'auditor_category',
    label: 'Auditor category',
    section: 'governance',
    kind: 'text',
    max: 120,
  },
  {
    key: 'financial_year_start_month',
    label: 'Financial year starts in',
    section: 'governance',
    kind: 'month',
    min: 1,
    max: 12,
    help: 'For reference only; reports keep their current periods.',
  },
  {
    key: 'wings_count',
    label: 'Number of wings',
    section: 'property',
    kind: 'integer',
    min: 0,
    max: 999,
  },
  {
    key: 'statutory_members_count',
    label: 'Statutory members',
    section: 'property',
    kind: 'integer',
    min: 0,
    max: 99999,
    help: 'Legal members of the society, not residents or occupants.',
  },
  {
    key: 'parking_count',
    label: 'Parking spaces',
    section: 'property',
    kind: 'integer',
    min: 0,
    max: 99999,
  },
  {
    key: 'construction_year',
    label: 'Construction year',
    section: 'property',
    kind: 'integer',
    min: 1800,
    max: 2200,
  },
  {
    key: 'built_up_area_sq_ft',
    label: 'Built-up area (sq ft)',
    section: 'property',
    kind: 'decimal',
    min: 0.01,
    max: 9_999_999_999.99,
  },
  {
    key: 'maintenance_rate_reference',
    label: 'Maintenance rate reference',
    section: 'finance',
    kind: 'text',
    max: 200,
    help: 'For reference only; charge heads stay authoritative.',
  },
  {
    key: 'sinking_fund_rate_reference',
    label: 'Sinking fund rate reference',
    section: 'finance',
    kind: 'text',
    max: 200,
  },
  {
    key: 'arrears_interest_reference',
    label: 'Arrears interest reference',
    section: 'finance',
    kind: 'text',
    max: 200,
    help: 'For reference only; late-fee rules stay authoritative.',
  },
  {
    key: 'grace_period_reference',
    label: 'Grace period reference',
    section: 'finance',
    kind: 'text',
    max: 200,
  },
  {
    key: 'bank_name',
    label: 'Bank name',
    section: 'finance',
    kind: 'text',
    restricted: true,
    max: 120,
  },
  {
    key: 'bank_account_last4',
    label: 'Last four account digits',
    section: 'finance',
    kind: 'text',
    restricted: true,
    max: 4,
    pattern: /^[0-9]{4}$/,
    patternMessage: 'Enter only the last four digits of the account.',
  },
  {
    key: 'ifsc',
    label: 'IFSC',
    section: 'finance',
    kind: 'text',
    restricted: true,
    max: 11,
    uppercase: true,
    pattern: PROFILE_IFSC_PATTERN,
    patternMessage: 'Enter an IFSC like SBIN0001234.',
  },
  {
    key: 'chairman_name',
    label: 'Chairman name',
    section: 'office_bearers',
    kind: 'text',
    max: 120,
  },
  {
    key: 'chairman_mobile',
    label: 'Chairman mobile',
    section: 'office_bearers',
    ...mobile,
  },
  {
    key: 'secretary_name',
    label: 'Secretary name',
    section: 'office_bearers',
    kind: 'text',
    max: 120,
  },
  {
    key: 'secretary_mobile',
    label: 'Secretary mobile',
    section: 'office_bearers',
    ...mobile,
  },
  {
    key: 'treasurer_name',
    label: 'Treasurer name',
    section: 'office_bearers',
    kind: 'text',
    max: 120,
  },
  {
    key: 'treasurer_mobile',
    label: 'Treasurer mobile',
    section: 'office_bearers',
    ...mobile,
  },
];

export const PROFILE_EDITABLE_FIELDS = PROFILE_FIELDS.filter(
  (field) => !field.fromSociety,
);

export const PROFILE_REQUIRED_KEYS = [
  'name',
  'society_type',
  'registration_number',
  'registration_date',
  'address',
  'city',
  'state',
  'pin_code',
  'contact_email',
  'contact_phone',
  'financial_year_start_month',
] as const;
export const PROFILE_COOPERATIVE_KEYS = [
  'registration_authority',
  'statutory_members_count',
  'auditor_name',
] as const;

export type ProfileFieldState =
  'filled' | 'missing' | 'optional' | 'not_applicable';
export const PROFILE_FIELD_STATE_LABELS: Readonly<
  Record<ProfileFieldState, string>
> = {
  filled: 'Filled',
  missing: 'Missing',
  optional: 'Optional',
  not_applicable: 'Not applicable',
};

export type ProfileValue = string | number | null;

function hasValue(value: ProfileValue | undefined) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/** Mirrors the database checklist rule; advisory only and never blocks a save. */
export function profileFieldState(
  key: string,
  values: Readonly<Record<string, ProfileValue | undefined>>,
): ProfileFieldState {
  if (hasValue(values[key])) return 'filled';
  if ((PROFILE_REQUIRED_KEYS as readonly string[]).includes(key))
    return 'missing';
  if ((PROFILE_COOPERATIVE_KEYS as readonly string[]).includes(key))
    return values.society_type === 'cooperative_housing_society'
      ? 'missing'
      : 'not_applicable';
  return 'optional';
}

export function profileSectionCompletion(
  section: ProfileSectionKey,
  values: Readonly<Record<string, ProfileValue | undefined>>,
  visibleKeys?: ReadonlySet<string>,
) {
  const states = PROFILE_FIELDS.filter(
    (field) =>
      field.section === section && (!visibleKeys || visibleKeys.has(field.key)),
  ).map((field) => profileFieldState(field.key, values));
  return {
    filled: states.filter((state) => state === 'filled').length,
    total: states.length,
    requiredMissing: states.filter((state) => state === 'missing').length,
  };
}

function profileValueSchema(field: ProfileField) {
  return z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      let clean = value.trim();
      if (field.uppercase) clean = clean.replace(/\s/g, '').toUpperCase();
      if (field.key.endsWith('_mobile')) clean = clean.replace(/[\s-]/g, '');
      return clean === '' ? null : clean;
    })
    .superRefine((value, context) => {
      if (value === null) return;
      const fail = (message: string) =>
        context.addIssue({ code: 'custom', message });
      const label = field.label.toLowerCase();
      if (field.kind === 'date') {
        if (!z.iso.date().safeParse(value).success)
          fail(`Enter a valid ${label}.`);
        return;
      }
      if (field.kind === 'society_type') {
        if (!(SOCIETY_TYPES as readonly string[]).includes(value))
          fail('Choose a society type.');
        return;
      }
      if (
        field.kind === 'integer' ||
        field.kind === 'month' ||
        field.kind === 'decimal'
      ) {
        const pattern =
          field.kind === 'decimal' ? /^\d+(\.\d{1,2})?$/ : /^\d+$/;
        const number = Number(value);
        if (
          !pattern.test(value) ||
          number < (field.min ?? 0) ||
          number > (field.max ?? Number.MAX_SAFE_INTEGER)
        )
          fail(`Enter a valid ${label}.`);
        return;
      }
      if (field.max && value.length > field.max)
        fail(`Keep the ${label} within ${field.max} characters.`);
      else if (field.pattern && !field.pattern.test(value))
        fail(field.patternMessage ?? `Enter a valid ${label}.`);
    });
}

export const societyProfileValuesSchema = z
  .object(
    Object.fromEntries(
      PROFILE_EDITABLE_FIELDS.map((field) => [
        field.key,
        profileValueSchema(field),
      ]),
    ) as Record<string, ReturnType<typeof profileValueSchema>>,
  )
  .strict();

export const societyProfileSaveInputSchema = z
  .object({
    values: societyProfileValuesSchema,
    expectedVersion: version.nullable(),
  })
  .strict();
export type SocietyProfileSaveInput = z.infer<
  typeof societyProfileSaveInputSchema
>;

const profileValue = z.union([z.string(), z.number(), z.null()]);
export const societyProfileSchema = z.object({
  society: z.object({
    name: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    contact_email: z.string().nullable(),
    contact_phone: z.string().nullable(),
  }),
  profile: z.record(z.string(), profileValue),
  restricted_visible: z.boolean(),
  can_manage: z.boolean(),
  version: version.nullable(),
  updated_at: z.string().nullable(),
  updated_by_name: z.string().nullable(),
  completeness: z.object({
    required_fields: z.array(z.string()),
    missing_fields: z.array(z.string()),
    required_count: z.number().int().min(0),
    filled_count: z.number().int().min(0),
  }),
});
export type SocietyProfileView = z.infer<typeof societyProfileSchema>;

export function profileValues(view: SocietyProfileView) {
  return { ...view.society, ...view.profile } as Readonly<
    Record<string, ProfileValue | undefined>
  >;
}

// Capability adoption ----------------------------------------------------------

export const ADOPTION_STATUSES = [
  'not_started',
  'exploring',
  'in_use',
  'mastered',
] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];
export const ADOPTION_STATUS_LABELS: Readonly<Record<AdoptionStatus, string>> =
  {
    not_started: 'Not started',
    exploring: 'Exploring',
    in_use: 'In use',
    mastered: 'Mastered',
  };

export const TOOLKIT_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ToolkitPriority = (typeof TOOLKIT_PRIORITIES)[number];
export const PRIORITY_LABELS: Readonly<Record<ToolkitPriority, string>> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const ADOPTION_NOTES_MAX = 1000;

const optionalUuid = z
  .union([z.literal(''), z.uuid(), z.null()])
  .transform((value) => value || null);

export const capabilityAdoptionSaveInputSchema = z
  .object({
    moduleKey: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    status: z.enum(ADOPTION_STATUSES, 'Choose an adoption status.'),
    priority: z.enum(TOOLKIT_PRIORITIES, 'Choose a priority.'),
    ownerMembershipId: optionalUuid,
    reviewOn: optionalDate,
    notes: optionalText(ADOPTION_NOTES_MAX),
    expectedVersion: version.nullable(),
  })
  .strict();
export type CapabilityAdoptionSaveInput = z.infer<
  typeof capabilityAdoptionSaveInputSchema
>;

const capabilitySchema = z.object({
  module_key: z.string(),
  module_name: z.string(),
  enabled: z.boolean(),
  status: z.enum(ADOPTION_STATUSES),
  priority: z.enum(TOOLKIT_PRIORITIES),
  owner_membership_id: z.uuid().nullable(),
  owner_name: z.string().nullable(),
  review_on: z.iso.date().nullable(),
  notes: z.string().nullable(),
  version: version.nullable(),
  updated_at: z.string().nullable(),
  updated_by_name: z.string().nullable(),
});
export type CapabilityAdoption = z.infer<typeof capabilitySchema>;
export const capabilityAdoptionsSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  capabilities: z.array(capabilitySchema),
});
export type CapabilityAdoptionsView = z.infer<typeof capabilityAdoptionsSchema>;
export const capabilityAdoptionResultSchema = z.object({
  module_key: z.string(),
});

export function adoptionSummary(
  capabilities: readonly CapabilityAdoption[],
  today: string,
) {
  return {
    inUse: capabilities.filter(
      (item) => item.status === 'in_use' || item.status === 'mastered',
    ).length,
    exploring: capabilities.filter((item) => item.status === 'exploring')
      .length,
    reviewPending: capabilities.filter(
      (item) => item.review_on !== null && item.review_on <= today,
    ).length,
    highPriorityNotStarted: capabilities.filter(
      (item) => item.priority === 'high' && item.status === 'not_started',
    ).length,
  };
}

// Committee action plans -------------------------------------------------------

export const ACTION_TASK_CATEGORIES = [
  'governance',
  'finance',
  'compliance',
  'operations',
  'communication',
  'technology',
  'safety',
] as const;
export type ActionTaskCategory = (typeof ACTION_TASK_CATEGORIES)[number];
export const ACTION_TASK_CATEGORY_LABELS: Readonly<
  Record<ActionTaskCategory, string>
> = {
  governance: 'Governance',
  finance: 'Finance',
  compliance: 'Compliance',
  operations: 'Operations',
  communication: 'Communication',
  technology: 'Technology',
  safety: 'Safety',
};

export const ACTION_TASK_STATUSES = [
  'not_started',
  'in_progress',
  'done',
  'blocked',
] as const;
export type ActionTaskStatus = (typeof ACTION_TASK_STATUSES)[number];
export const ACTION_TASK_STATUS_LABELS: Readonly<
  Record<ActionTaskStatus, string>
> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};

export const ACTION_TIMELINES = [
  'done',
  'overdue',
  'upcoming',
  'on_track',
] as const;
export type ActionTimeline = (typeof ACTION_TIMELINES)[number];

export const ACTION_PLAN_NAME_MAX = 120;
export const ACTION_PLAN_NOTES_MAX = 1000;
export const ACTION_TASK_TITLE_MAX = 300;
export const ACTION_TASK_DAY_MAX = 3650;
export const ACTION_TASK_LINK_MAX = 2048;
export const LINKED_ACTION_DONE_MESSAGE =
  'Complete the linked meeting action instead.';

export const actionPlanSaveInputSchema = z
  .object({
    planId: z.uuid().nullable(),
    name: z.string().trim().min(1, 'Name the plan.').max(ACTION_PLAN_NAME_MAX),
    startOn: z.iso.date('Choose a start date.'),
    notes: optionalText(ACTION_PLAN_NOTES_MAX),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    (input) => (input.planId === null) === (input.expectedVersion === null),
    { path: ['expectedVersion'], message: 'Refresh the plan and retry.' },
  )
  .refine((input) => input.planId !== null || input.clientRequestId !== null, {
    path: ['clientRequestId'],
    message: 'Retry the request.',
  });
export type ActionPlanSaveInput = z.infer<typeof actionPlanSaveInputSchema>;

export const actionPlanArchiveInputSchema = z
  .object({
    planId: z.uuid(),
    archived: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const actionPlanSampleInputSchema = z
  .object({
    name: optionalText(ACTION_PLAN_NAME_MAX),
    startOn: optionalDate,
    clientRequestId: z.uuid(),
  })
  .strict();

const taskDay = z.coerce
  .number('Enter a day number.')
  .int('Enter a whole day number.')
  .min(1, 'Days start at 1.')
  .max(ACTION_TASK_DAY_MAX, `Use a day up to ${ACTION_TASK_DAY_MAX}.`);

export const actionTaskSaveInputSchema = z
  .object({
    taskId: z.uuid().nullable(),
    planId: z.uuid(),
    title: z
      .string()
      .trim()
      .min(1, 'Describe the task.')
      .max(ACTION_TASK_TITLE_MAX),
    category: z.enum(ACTION_TASK_CATEGORIES, 'Choose a category.'),
    priority: z.enum(TOOLKIT_PRIORITIES, 'Choose a priority.'),
    ownerMembershipId: optionalUuid,
    startDay: taskDay,
    endDay: taskDay,
    status: z.enum(ACTION_TASK_STATUSES, 'Choose a status.'),
    progress: z.coerce
      .number('Enter progress from 0 to 100.')
      .int('Enter progress from 0 to 100.')
      .min(0, 'Enter progress from 0 to 100.')
      .max(100, 'Enter progress from 0 to 100.'),
    notes: optionalText(ACTION_PLAN_NOTES_MAX),
    evidenceUrl: optionalText(ACTION_TASK_LINK_MAX).refine(
      (value) => value === null || /^https?:\/\/\S+$/i.test(value),
      'Enter an evidence link starting with http:// or https://.',
    ),
    meetingActionItemId: optionalUuid,
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .refine((input) => input.endDay >= input.startDay, {
    path: ['endDay'],
    message: 'The end day must be on or after the start day.',
  })
  .refine((input) => !(input.meetingActionItemId && input.status === 'done'), {
    path: ['status'],
    message: LINKED_ACTION_DONE_MESSAGE,
  })
  .refine(
    (input) => (input.taskId === null) === (input.expectedVersion === null),
    { path: ['expectedVersion'], message: 'Refresh the task and retry.' },
  )
  .refine((input) => input.taskId !== null || input.clientRequestId !== null, {
    path: ['clientRequestId'],
    message: 'Retry the request.',
  });
export type ActionTaskSaveInput = z.infer<typeof actionTaskSaveInputSchema>;

const actionTaskSchema = z.object({
  id: z.uuid(),
  plan_id: z.uuid(),
  title: z.string(),
  category: z.enum(ACTION_TASK_CATEGORIES),
  priority: z.enum(TOOLKIT_PRIORITIES),
  owner_membership_id: z.uuid().nullable(),
  owner_name: z.string().nullable(),
  start_day: z.number().int(),
  end_day: z.number().int(),
  start_on: z.iso.date(),
  due_on: z.iso.date(),
  days_left: z.number().int(),
  status: z.enum(ACTION_TASK_STATUSES),
  progress: z.number().int().min(0).max(100),
  timeline: z.enum(ACTION_TIMELINES),
  notes: z.string().nullable(),
  evidence_url: z.string().nullable(),
  meeting_action: z
    .object({
      id: z.uuid(),
      meeting_id: z.uuid(),
      title: z.string(),
      status: z.enum(['open', 'done']),
      due_on: z.iso.date(),
    })
    .nullable(),
  version: version,
  updated_at: z.string(),
  updated_by_name: z.string().nullable(),
});
export type ActionTask = z.infer<typeof actionTaskSchema>;

const actionPlanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  start_on: z.iso.date(),
  notes: z.string().nullable().optional(),
  archived_at: z.string().nullable(),
  version: version.optional(),
  created_at: z.string().optional(),
  created_by_name: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  updated_by_name: z.string().nullable().optional(),
  tasks: z.array(actionTaskSchema),
});
export type ActionPlan = z.infer<typeof actionPlanSchema>;

export const actionPlansSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  plans: z.array(actionPlanSchema),
});
export type ActionPlansView = z.infer<typeof actionPlansSchema>;
export const actionPlanIdSchema = z.uuid();

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const ACTION_PLAN_WINDOW_DAYS = 7;

export function actionPlanSummary(tasks: readonly ActionTask[], today: string) {
  const windowEnd = addDays(today, ACTION_PLAN_WINDOW_DAYS);
  const open = tasks.filter((task) => task.status !== 'done');
  return {
    total: tasks.length,
    completed: tasks.length - open.length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    overdue: tasks.filter((task) => task.timeline === 'overdue').length,
    highPriorityOpen: open.filter((task) => task.priority === 'high').length,
    progressPercent: tasks.length
      ? Math.round(
          tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length,
        )
      : 0,
    nextSevenDays: open.filter(
      (task) => task.due_on >= today && task.due_on <= windowEnd,
    ).length,
  };
}

/** Groups tasks by the plan week in which they are due (week 1 = plan days 1–7). */
export function actionPlanWeeks(plan: Pick<ActionPlan, 'start_on' | 'tasks'>) {
  const weeks = new Map<number, ActionTask[]>();
  for (const task of plan.tasks) {
    const week = Math.ceil(task.end_day / 7);
    weeks.set(week, [...(weeks.get(week) ?? []), task]);
  }
  return [...weeks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([week, tasks]) => ({
      week,
      from: addDays(plan.start_on, (week - 1) * 7),
      to: addDays(plan.start_on, week * 7 - 1),
      tasks,
    }));
}

// Owner and meeting-action pickers ---------------------------------------------

export type ToolkitMemberOption = {
  membershipId: string;
  label: string;
  manager: boolean;
};

export type MeetingActionOption = {
  id: string;
  label: string;
};
