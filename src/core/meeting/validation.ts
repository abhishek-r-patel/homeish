// Validate Meetings & AGM settings, form input and the database read models.
import { z } from 'zod';

export const DEFAULT_MEETING_SETTINGS = {
  notice_days_agm: 14,
  notice_days_sgm: 7,
  notice_days_committee: 3,
  quorum_percent_units: 33,
  quorum_percent_committee: 50,
  action_owner_scope: 'any_member',
} as const;

const noticeDays = z.number().int().min(0).max(90);
const quorumPercent = z.number().int().min(1).max(100);

export const meetingSettingsSchema = z
  .object({
    notice_days_agm: noticeDays.optional(),
    notice_days_sgm: noticeDays.optional(),
    notice_days_committee: noticeDays.optional(),
    quorum_percent_units: quorumPercent.optional(),
    quorum_percent_committee: quorumPercent.optional(),
    action_owner_scope: z.enum(['any_member', 'management']).optional(),
  })
  .strict();

export type MeetingSettings = {
  notice_days_agm: number;
  notice_days_sgm: number;
  notice_days_committee: number;
  quorum_percent_units: number;
  quorum_percent_committee: number;
  action_owner_scope: 'any_member' | 'management';
};

export const meetingSettingsInputSchema = z
  .object({
    notice_days_agm: noticeDays,
    notice_days_sgm: noticeDays,
    notice_days_committee: noticeDays,
    quorum_percent_units: quorumPercent,
    quorum_percent_committee: quorumPercent,
    action_owner_scope: z.enum(['any_member', 'management']),
  })
  .strict();

function snakeCaseKey(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Settings reads may arrive flat or wrapped, in snake_case or camelCase; defaults fill gaps.
export function normalizeMeetingSettings(value: unknown): MeetingSettings {
  const source =
    typeof value === 'object' &&
    value !== null &&
    'settings' in value &&
    typeof (value as { settings: unknown }).settings === 'object'
      ? (value as { settings: unknown }).settings
      : value;
  const entries =
    typeof source === 'object' && source !== null
      ? Object.entries(source).map(([key, entry]) => [snakeCaseKey(key), entry])
      : [];
  const known = new Set(Object.keys(DEFAULT_MEETING_SETTINGS));
  const parsed = meetingSettingsSchema.parse(
    Object.fromEntries(entries.filter(([key]) => known.has(String(key)))),
  );
  return { ...DEFAULT_MEETING_SETTINGS, ...parsed };
}

export const MEETING_TITLE_MAX = 150;
export const MEETING_DESCRIPTION_MAX = 4000;
export const MEETING_VENUE_MAX = 200;
export const MEETING_ONLINE_URL_MAX = 500;
export const MEETING_AGENDA_LIMIT = 50;
export const MEETING_AGENDA_TITLE_MAX = 200;
export const MEETING_AGENDA_DESCRIPTION_MAX = 2000;
export const MEETING_REASON_MAX = 500;
export const MEETING_PROXY_NAME_MAX = 120;
export const MEETING_RESOLUTION_TITLE_MAX = 200;
export const MEETING_RESOLUTION_BODY_MAX = 5000;
export const MEETING_MINUTES_MAX = 50000;
export const MEETING_ACTION_TITLE_MAX = 300;
export const MEETING_ACTION_NOTE_MAX = 500;
export const MEETING_INVITEE_LIMIT = 5000;

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const isoDate = z.iso.date();
const version = z.number().int().min(1).max(2_147_483_647);
const count = z.number().int().min(0);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

export const MEETING_TYPES = ['agm', 'sgm', 'committee'] as const;
export const MEETING_STATUSES = [
  'draft',
  'scheduled',
  'held',
  'cancelled',
] as const;
export const MEETING_ADMIN_MODES = ['in_person', 'online', 'proxy'] as const;
export const MEETING_OUTCOMES = [
  'pending',
  'passed',
  'failed',
  'deferred',
] as const;

export const meetingTypeSchema = z.enum(MEETING_TYPES);
export const meetingStatusSchema = z.enum(MEETING_STATUSES);
const attendanceModeSchema = z.enum([...MEETING_ADMIN_MODES, 'self']);
const outcomeSchema = z.enum(MEETING_OUTCOMES);
const actionStatusSchema = z.enum(['open', 'done']);
const minutesStatusSchema = z.enum(['draft', 'published']);

export type MeetingType = z.infer<typeof meetingTypeSchema>;
export type MeetingStatus = z.infer<typeof meetingStatusSchema>;
export type MeetingAttendanceMode = z.infer<typeof attendanceModeSchema>;
export type MeetingOutcome = z.infer<typeof outcomeSchema>;

export function isUnitMeeting(type: MeetingType) {
  return type !== 'committee';
}

const onlineUrlSchema = z
  .string()
  .trim()
  .max(MEETING_ONLINE_URL_MAX)
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https:\/\/[^\s]+$/i.test(value), {
    message: 'Use a secure link that starts with https://.',
  });

const agendaInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give every agenda item a title.')
      .max(MEETING_AGENDA_TITLE_MAX),
    description: optionalText(MEETING_AGENDA_DESCRIPTION_MAX),
  })
  .strict();

const inviteesInputSchema = z.union([
  z.object({ scope: z.literal('default') }).strict(),
  z
    .object({
      scope: z.literal('custom'),
      unitIds: z.array(uuid).max(MEETING_INVITEE_LIMIT),
    })
    .strict(),
  z
    .object({
      scope: z.literal('custom'),
      membershipIds: z.array(uuid).max(MEETING_INVITEE_LIMIT),
    })
    .strict(),
]);

export const meetingInputSchema = z
  .object({
    meetingType: meetingTypeSchema,
    title: z.string().trim().max(MEETING_TITLE_MAX),
    description: optionalText(MEETING_DESCRIPTION_MAX),
    startsAt: nullableTimestamp,
    endsAt: nullableTimestamp,
    venue: optionalText(MEETING_VENUE_MAX),
    onlineUrl: onlineUrlSchema,
    agenda: z
      .array(agendaInputSchema)
      .max(MEETING_AGENDA_LIMIT, 'Keep the agenda to 50 items or fewer.'),
    invitees: inviteesInputSchema,
  })
  .strict()
  .superRefine((meeting, context) => {
    if (
      meeting.invitees.scope === 'custom' &&
      'unitIds' in meeting.invitees !== isUnitMeeting(meeting.meetingType)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['invitees'],
        message:
          'Choose units for AGM and SGM meetings, or committee members for committee meetings.',
      });
    }
    if (meeting.startsAt && meeting.endsAt) {
      const span =
        new Date(meeting.endsAt).getTime() -
        new Date(meeting.startsAt).getTime();
      if (span <= 0) {
        context.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: 'The meeting must end after it starts.',
        });
      } else if (span > 24 * 60 * 60 * 1000) {
        context.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: 'A meeting can last at most 24 hours.',
        });
      }
    }
  });

export type MeetingInput = z.infer<typeof meetingInputSchema>;

export const meetingCreateInputSchema = z
  .object({ clientRequestId: uuid, meeting: meetingInputSchema })
  .strict();

export const meetingUpdateInputSchema = z
  .object({
    meetingId: uuid,
    expectedVersion: version,
    meeting: meetingInputSchema,
  })
  .strict();

export const meetingIdInputSchema = z.object({ meetingId: uuid }).strict();

export const meetingVersionInputSchema = z
  .object({ meetingId: uuid, expectedVersion: version })
  .strict();

export const meetingCancelInputSchema = z
  .object({
    meetingId: uuid,
    expectedVersion: version,
    reason: z
      .string()
      .trim()
      .min(1, 'Give a reason for cancelling.')
      .max(MEETING_REASON_MAX),
  })
  .strict();

export const meetingCheckinSetInputSchema = z
  .object({ meetingId: uuid, open: z.boolean() })
  .strict();

export const meetingAttendanceSetInputSchema = z
  .object({
    meetingId: uuid,
    attendeeId: uuid,
    mode: z.enum(MEETING_ADMIN_MODES),
    proxyName: optionalText(MEETING_PROXY_NAME_MAX),
  })
  .strict()
  .refine((input) => (input.mode === 'proxy') === (input.proxyName !== null), {
    path: ['proxyName'],
    message: 'Enter the proxy’s name only when attendance is by proxy.',
  });

export const meetingAttendanceRemoveInputSchema = z
  .object({ meetingId: uuid, attendeeId: uuid })
  .strict();

export const meetingSelfCheckinInputSchema = z
  .object({ meetingId: uuid, unitId: uuid })
  .strict();

export const meetingResolutionSaveInputSchema = z
  .object({
    meetingId: uuid,
    resolutionId: uuid.nullable(),
    expectedVersion: version.nullable(),
    resolution: z
      .object({
        title: z
          .string()
          .trim()
          .min(1, 'Give the resolution a title.')
          .max(MEETING_RESOLUTION_TITLE_MAX),
        body: optionalText(MEETING_RESOLUTION_BODY_MAX),
        agendaItemId: uuid.nullable(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (input) =>
      (input.resolutionId === null) === (input.expectedVersion === null),
    { path: ['expectedVersion'], message: 'Refresh the resolution and retry.' },
  );

export const meetingResolutionDeleteInputSchema = z
  .object({ resolutionId: uuid, expectedVersion: version })
  .strict();

const voteCount = z.number().int().min(0).max(1_000_000).nullable();

export const meetingResolutionOutcomeInputSchema = z
  .object({
    resolutionId: uuid,
    expectedVersion: version,
    outcome: outcomeSchema,
    votesFor: voteCount,
    votesAgainst: voteCount,
    votesAbstain: voteCount,
  })
  .strict();

export const meetingResolutionPollLinkInputSchema = z
  .object({
    resolutionId: uuid,
    expectedVersion: version,
    pollVoteId: uuid.nullable(),
  })
  .strict();

export const meetingResolutionPollCreateInputSchema = z
  .object({
    meetingId: uuid,
    resolutionId: uuid,
    expectedVersion: version,
    clientRequestId: uuid,
  })
  .strict();

export const meetingMinutesSaveInputSchema = z
  .object({
    meetingId: uuid,
    expectedVersion: version.nullable(),
    body: z
      .string()
      .trim()
      .min(1, 'Write the minutes before saving.')
      .max(MEETING_MINUTES_MAX),
  })
  .strict();

export const meetingMinutesPublishInputSchema = z
  .object({
    meetingId: uuid,
    expectedVersion: version,
    folderId: uuid.nullable(),
  })
  .strict();

export const meetingDocumentCopyInputSchema = z
  .object({ meetingId: uuid, folderId: uuid.nullable() })
  .strict();

export const meetingActionSaveInputSchema = z
  .object({
    meetingId: uuid,
    actionId: uuid.nullable(),
    expectedVersion: version.nullable(),
    action: z
      .object({
        title: z
          .string()
          .trim()
          .min(1, 'Describe the action item.')
          .max(MEETING_ACTION_TITLE_MAX),
        ownerMembershipId: uuid,
        dueOn: isoDate,
        resolutionId: uuid.nullable(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (input) => (input.actionId === null) === (input.expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the action item and retry.',
    },
  );

export const meetingActionStatusInputSchema = z
  .object({
    actionId: uuid,
    expectedVersion: version,
    status: actionStatusSchema,
    note: optionalText(MEETING_ACTION_NOTE_MAX),
  })
  .strict();

export const meetingOwnerSearchInputSchema = z
  .object({ search: z.string().trim().max(100) })
  .strict();

export const meetingListFilterSchema = meetingStatusSchema
  .nullable()
  .catch(null);

// Read models stay tolerant of extra keys so additive database fields do not break screens.
const quorumSchema = z.object({
  invited: count,
  present: count,
  percent: z.number().int().min(1).max(100).nullable(),
  met: z.boolean(),
});

const agendaItemSchema = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable(),
});

const pollSummarySchema = z
  .object({ id: uuid, title: z.string(), status: z.string() })
  .nullable();

const actionItemSchema = z.object({
  id: uuid,
  title: z.string(),
  ownerMembershipId: uuid,
  ownerName: z.string(),
  dueOn: isoDate,
  status: actionStatusSchema,
  note: z.string().nullable(),
  resolutionId: uuid.nullable(),
  version,
  overdue: z.boolean(),
});

const myActionSchema = z.object({
  id: uuid,
  meetingId: uuid,
  meetingTitle: z.string().nullable(),
  title: z.string(),
  dueOn: isoDate,
  status: actionStatusSchema,
  overdue: z.boolean(),
  version,
});

export const meetingWriteResultSchema = z.object({
  meetingId: uuid,
  version,
});

const noticeSchema = z.object({
  requiredDays: z.number().int().min(0),
  givenDays: z.number().int(),
  short: z.boolean(),
});

export const meetingUpdateResultSchema = meetingWriteResultSchema.extend({
  rescheduled: z.boolean(),
  notice: noticeSchema.nullable(),
});

export const meetingScheduleResultSchema = meetingWriteResultSchema.extend({
  notice: noticeSchema,
});

export const meetingDeletedResultSchema = z.object({
  deleted: z.literal(true),
});

export const meetingCheckinResultSchema = z.object({
  meetingId: uuid,
  checkinOpen: z.boolean(),
});

export const meetingAttendanceResultSchema = z.object({
  meetingId: uuid,
  attendeeId: uuid,
  mode: attendanceModeSchema,
});

export const meetingAttendanceRemoveResultSchema = z.object({
  removed: z.boolean(),
});

export const meetingSelfCheckinResultSchema = z.object({
  meetingId: uuid,
  unitId: uuid,
  present: z.literal(true),
  alreadyPresent: z.boolean(),
});

export const meetingResolutionResultSchema = z.object({
  resolutionId: uuid,
  version,
});

export const meetingPollLinkResultSchema = meetingResolutionResultSchema.extend(
  { pollVoteId: uuid.nullable() },
);

export const meetingMinutesSaveResultSchema = z.object({
  meetingId: uuid,
  version,
  status: minutesStatusSchema,
});

export const meetingMinutesPublishResultSchema = z.object({
  meetingId: uuid,
  version,
  publishedAt: timestamp,
});

export const meetingDocumentLinkResultSchema = z.object({
  meetingId: uuid,
  documentId: uuid,
});

export const meetingActionResultSchema = z.object({
  actionId: uuid,
  version,
});

export const meetingActionStatusResultSchema = meetingActionResultSchema.extend(
  { status: actionStatusSchema },
);

export const meetingAdminListSchema = z.object({
  items: z.array(
    z.object({
      id: uuid,
      meetingType: meetingTypeSchema,
      title: z.string(),
      status: meetingStatusSchema,
      startsAt: nullableTimestamp,
      endsAt: nullableTimestamp,
      invitedCount: count,
      presentCount: count,
      quorumPercent: z.number().int().nullable(),
      quorumMet: z.boolean().nullable(),
      minutesStatus: z.enum(['none', 'draft', 'published']),
    }),
  ),
  total: count,
});

export const meetingAdminGetSchema = z.object({
  meeting: z.object({
    id: uuid,
    meetingType: meetingTypeSchema,
    status: meetingStatusSchema,
    title: z.string(),
    description: z.string().nullable(),
    startsAt: nullableTimestamp,
    endsAt: nullableTimestamp,
    venue: z.string().nullable(),
    onlineUrl: z.string().nullable(),
    inviteeScope: z.enum(['default', 'custom']),
    noticeRequiredDays: z.number().int().nullable(),
    noticeGivenDays: z.number().int().nullable(),
    quorumPercent: z.number().int().nullable(),
    checkinOpen: z.boolean(),
    version,
    scheduledAt: nullableTimestamp.optional(),
    rescheduledAt: nullableTimestamp.optional(),
    heldAt: nullableTimestamp.optional(),
    cancelledAt: nullableTimestamp.optional(),
    cancellationReason: z.string().nullable().optional(),
  }),
  agenda: z.array(agendaItemSchema),
  invitees: z.object({
    scope: z.enum(['default', 'custom']),
    unitIds: z.array(uuid).optional(),
    membershipIds: z.array(uuid).optional(),
  }),
  invited: z.array(z.object({ attendeeId: uuid, label: z.string() })),
  attendance: z.array(
    z.object({
      attendeeId: uuid,
      label: z.string(),
      mode: attendanceModeSchema,
      proxyName: z.string().nullable(),
      recordedAt: timestamp,
      recordedByName: z.string().nullable(),
    }),
  ),
  quorum: quorumSchema,
  resolutions: z.array(
    z.object({
      id: uuid,
      agendaItemId: uuid.nullable(),
      title: z.string(),
      body: z.string().nullable(),
      outcome: outcomeSchema,
      votesFor: z.number().int().nullable(),
      votesAgainst: z.number().int().nullable(),
      votesAbstain: z.number().int().nullable(),
      version,
      poll: pollSummarySchema,
    }),
  ),
  minutes: z
    .object({
      status: minutesStatusSchema,
      body: z.string(),
      version,
      updatedAt: timestamp,
      updatedByName: z.string().nullable(),
      publishedAt: nullableTimestamp,
      documentId: uuid.nullable(),
    })
    .nullable(),
  actions: z.array(actionItemSchema),
  settings: z.unknown().optional(),
});

export const meetingInviteeOptionsSchema = z.object({
  units: z.array(
    z.object({
      unitId: uuid,
      label: z.string(),
      blockId: uuid.nullable(),
      blockName: z.string().nullable(),
      floor: z.number().int().nullable(),
    }),
  ),
  members: z.array(z.object({ membershipId: uuid, name: z.string() })),
});

export const meetingOwnerOptionsSchema = z.object({
  items: z.array(
    z.object({ membershipId: uuid, name: z.string(), roleLabel: z.string() }),
  ),
});

export const meetingMemberListSchema = z.object({
  meetings: z.array(
    z.object({
      id: uuid,
      meetingType: meetingTypeSchema,
      title: z.string(),
      status: meetingStatusSchema,
      startsAt: timestamp,
      endsAt: timestamp,
      venue: z.string().nullable(),
      onlineUrl: z.string().nullable(),
      minutesPublished: z.boolean(),
    }),
  ),
  actions: z.array(myActionSchema),
});

export const meetingMemberGetSchema = z.object({
  meeting: z.object({
    id: uuid,
    meetingType: meetingTypeSchema,
    title: z.string(),
    description: z.string().nullable(),
    status: meetingStatusSchema,
    startsAt: timestamp,
    endsAt: timestamp,
    venue: z.string().nullable(),
    onlineUrl: z.string().nullable(),
    checkinOpen: z.boolean(),
    cancellationReason: z.string().nullable(),
  }),
  agenda: z.array(agendaItemSchema),
  myUnits: z.array(
    z.object({
      unitId: uuid,
      label: z.string(),
      present: z.boolean(),
      mode: attendanceModeSchema.nullable(),
      canCheckIn: z.boolean(),
    }),
  ),
  quorum: quorumSchema,
  resolutions: z.array(
    z.object({
      id: uuid,
      title: z.string(),
      body: z.string().nullable().optional(),
      outcome: outcomeSchema,
      votesFor: z.number().int().nullable(),
      votesAgainst: z.number().int().nullable(),
      votesAbstain: z.number().int().nullable(),
      poll: pollSummarySchema,
    }),
  ),
  minutes: z.object({ body: z.string(), publishedAt: timestamp }).nullable(),
});

export const meetingMyActionsSchema = z.object({
  items: z.array(myActionSchema),
});

export type MeetingAdminList = z.infer<typeof meetingAdminListSchema>;
export type MeetingAdminDetail = z.infer<typeof meetingAdminGetSchema>;
export type MeetingInviteeOptions = z.infer<typeof meetingInviteeOptionsSchema>;
export type MeetingOwnerOption = z.infer<
  typeof meetingOwnerOptionsSchema
>['items'][number];
export type MeetingMemberList = z.infer<typeof meetingMemberListSchema>;
export type MeetingMemberDetail = z.infer<typeof meetingMemberGetSchema>;
export type MeetingMyAction = z.infer<typeof myActionSchema>;
export type MeetingActionItem = z.infer<typeof actionItemSchema>;
export type MeetingQuorum = z.infer<typeof quorumSchema>;
