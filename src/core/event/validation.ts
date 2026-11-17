// Validate Events & RSVPs settings, form input and the database read models.
import { z } from 'zod';

export const DEFAULT_EVENT_SETTINGS = {} as const;

export const eventSettingsSchema = z.object({}).strict();

export const EVENT_TITLE_MAX = 150;
export const EVENT_DESCRIPTION_MAX = 4000;
export const EVENT_VENUE_MAX = 200;
export const EVENT_REASON_MAX = 500;
export const EVENT_CAPACITY_MAX = 100_000;
export const EVENT_HEADCOUNT_MAX = 100;
export const EVENT_CONTRIBUTION_MAX_PAISE = 10_000_000;
export const EVENT_MAX_SPAN_MS = 14 * 24 * 60 * 60 * 1000;
export const EVENT_BLOCK_LIMIT = 500;

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const version = z.number().int().min(1).max(2_147_483_647);
const count = z.number().int().min(0);
const paise = z.number().int().min(0);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

export const EVENT_STATUSES = ['draft', 'published', 'cancelled'] as const;
export const EVENT_CONTRIBUTION_TYPES = [
  'none',
  'per_unit',
  'per_head',
] as const;
export const EVENT_RSVP_STATUSES = ['going', 'not_going'] as const;
export const EVENT_ADMIN_FILTERS = [
  'upcoming',
  'past',
  'drafts',
  'cancelled',
  'all',
] as const;
export const EVENT_MEMBER_FILTERS = ['upcoming', 'past'] as const;

export const eventStatusSchema = z.enum(EVENT_STATUSES);
export const eventContributionTypeSchema = z.enum(EVENT_CONTRIBUTION_TYPES);
export const eventRsvpStatusSchema = z.enum(EVENT_RSVP_STATUSES);

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventContributionTypeValue = z.infer<
  typeof eventContributionTypeSchema
>;
export type EventRsvpStatus = z.infer<typeof eventRsvpStatusSchema>;
export type EventAdminFilter = (typeof EVENT_ADMIN_FILTERS)[number];
export type EventMemberFilter = (typeof EVENT_MEMBER_FILTERS)[number];

export const eventAdminFilterSchema = z
  .enum(EVENT_ADMIN_FILTERS)
  .catch('upcoming');
export const eventMemberFilterSchema = z
  .enum(EVENT_MEMBER_FILTERS)
  .catch('upcoming');

const audienceInputSchema = z.union([
  z.object({ scope: z.literal('all') }).strict(),
  z
    .object({
      scope: z.literal('blocks'),
      blockIds: z.array(uuid).max(EVENT_BLOCK_LIMIT),
    })
    .strict(),
]);

export const eventInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give the event a title.')
      .max(EVENT_TITLE_MAX),
    description: optionalText(EVENT_DESCRIPTION_MAX),
    venue: optionalText(EVENT_VENUE_MAX),
    startsAt: timestamp,
    endsAt: timestamp,
    rsvpDeadline: nullableTimestamp,
    capacity: z
      .number()
      .int('Enter a whole number of places.')
      .min(1, 'Capacity must be at least 1.')
      .max(EVENT_CAPACITY_MAX)
      .nullable(),
    maxPerUnit: z
      .number()
      .int('Enter a whole number of people.')
      .min(1, 'Allow at least 1 person per flat.')
      .max(EVENT_HEADCOUNT_MAX, 'Allow at most 100 people per flat.')
      .nullable(),
    contributionType: eventContributionTypeSchema,
    contributionPaise: z
      .number()
      .int()
      .min(0)
      .max(
        EVENT_CONTRIBUTION_MAX_PAISE,
        'Keep the contribution at ₹1,00,000 or less.',
      ),
    audience: audienceInputSchema,
  })
  .strict()
  .superRefine((event, context) => {
    const starts = new Date(event.startsAt).getTime();
    const span = new Date(event.endsAt).getTime() - starts;
    if (span <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'The event must end after it starts.',
      });
    } else if (span > EVENT_MAX_SPAN_MS) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'An event can last at most 14 days.',
      });
    }
    if (
      event.rsvpDeadline !== null &&
      new Date(event.rsvpDeadline).getTime() > starts
    ) {
      context.addIssue({
        code: 'custom',
        path: ['rsvpDeadline'],
        message: 'The RSVP deadline must be on or before the start time.',
      });
    }
    if (
      (event.contributionType === 'none') !==
      (event.contributionPaise === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['contributionPaise'],
        message:
          event.contributionType === 'none'
            ? 'Remove the amount, or choose how the contribution is charged.'
            : 'Enter a contribution amount above zero.',
      });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export const eventCreateInputSchema = z
  .object({ clientRequestId: uuid, event: eventInputSchema })
  .strict();

export const eventUpdateInputSchema = z
  .object({ eventId: uuid, expectedVersion: version, event: eventInputSchema })
  .strict();

export const eventIdInputSchema = z.object({ eventId: uuid }).strict();

export const eventVersionInputSchema = z
  .object({ eventId: uuid, expectedVersion: version })
  .strict();

export const eventCancelInputSchema = z
  .object({
    eventId: uuid,
    expectedVersion: version,
    reason: z
      .string()
      .trim()
      .min(1, 'Give a reason for cancelling.')
      .max(EVENT_REASON_MAX),
  })
  .strict();

export const eventRsvpInputSchema = z
  .object({
    eventId: uuid,
    unitId: uuid,
    status: eventRsvpStatusSchema,
    headcount: z.number().int().min(0).max(EVENT_HEADCOUNT_MAX),
    expectedVersion: version.nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.status === 'going' && input.headcount < 1) {
      context.addIssue({
        code: 'custom',
        path: ['headcount'],
        message: 'Tell us how many people are coming (at least 1).',
      });
    }
    if (input.status === 'not_going' && input.headcount !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['headcount'],
        message: 'Headcount must be 0 when not going.',
      });
    }
  });

// Read models stay tolerant of extra keys so additive database fields do not break screens.
const audienceSchema = z.object({
  scope: z.enum(['all', 'blocks']),
  blockIds: z.array(uuid).optional().default([]),
});

export const eventWriteResultSchema = z.object({ eventId: uuid, version });

export const eventUpdateResultSchema = eventWriteResultSchema.extend({
  notified: z.boolean(),
  withdrawnUnits: count,
  refundedUnits: count,
});

export const eventPublishResultSchema = eventWriteResultSchema.extend({
  notified: count,
});

export const eventCancelResultSchema = eventWriteResultSchema.extend({
  refundedUnits: count,
});

export const eventDeletedResultSchema = z.object({ deleted: z.literal(true) });

export const eventRsvpResultSchema = z.object({
  rsvpId: uuid,
  status: eventRsvpStatusSchema,
  headcount: count,
  version,
  chargedPaise: paise,
});

export const eventAdminListSchema = z.object({
  items: z.array(
    z.object({
      id: uuid,
      title: z.string(),
      status: eventStatusSchema,
      startsAt: timestamp,
      endsAt: timestamp,
      venue: z.string().nullable(),
      past: z.boolean(),
      goingUnits: count,
      goingHeadcount: count,
      capacity: z.number().int().nullable(),
      contributionType: eventContributionTypeSchema,
      contributionPaise: paise,
    }),
  ),
  total: count,
});

export const eventAdminGetSchema = z.object({
  event: z.object({
    id: uuid,
    status: eventStatusSchema,
    title: z.string(),
    description: z.string().nullable(),
    venue: z.string().nullable(),
    startsAt: timestamp,
    endsAt: timestamp,
    rsvpDeadline: nullableTimestamp,
    capacity: z.number().int().nullable(),
    maxPerUnit: z.number().int().nullable(),
    contributionType: eventContributionTypeSchema,
    contributionPaise: paise,
    audience: audienceSchema,
    past: z.boolean(),
    version,
    publishedAt: nullableTimestamp.optional(),
    cancelledAt: nullableTimestamp.optional(),
    cancellationReason: z.string().nullable().optional(),
  }),
  totals: z.object({
    goingUnits: count,
    goingHeadcount: count,
    notGoingUnits: count,
    audienceUnits: count,
    collectedPaise: paise,
  }),
  rsvps: z.array(
    z.object({
      rsvpId: uuid,
      unitId: uuid,
      unitLabel: z.string(),
      status: eventRsvpStatusSchema,
      headcount: count,
      respondedByName: z.string().nullable(),
      respondedAt: timestamp,
      netChargePaise: paise,
    }),
  ),
  billingEnabled: z.boolean(),
});

export const eventBlockOptionsSchema = z.object({
  blocks: z.array(z.object({ blockId: uuid, name: z.string() })),
});

export const eventMemberListSchema = z.object({
  items: z.array(
    z.object({
      id: uuid,
      title: z.string(),
      status: eventStatusSchema,
      startsAt: timestamp,
      endsAt: timestamp,
      venue: z.string().nullable(),
      past: z.boolean(),
      rsvpClosesAt: timestamp,
      contributionType: eventContributionTypeSchema,
      contributionPaise: paise,
      myRsvps: z.array(
        z.object({
          unitId: uuid,
          label: z.string(),
          status: eventRsvpStatusSchema.nullable(),
          headcount: count.nullable(),
        }),
      ),
    }),
  ),
});

export const eventMemberGetSchema = z.object({
  event: z.object({
    id: uuid,
    title: z.string(),
    description: z.string().nullable(),
    status: eventStatusSchema,
    venue: z.string().nullable(),
    startsAt: timestamp,
    endsAt: timestamp,
    rsvpDeadline: nullableTimestamp,
    rsvpClosesAt: timestamp,
    rsvpOpen: z.boolean(),
    capacity: z.number().int().nullable(),
    maxPerUnit: z.number().int().nullable(),
    contributionType: eventContributionTypeSchema,
    contributionPaise: paise,
    cancellationReason: z.string().nullable(),
    past: z.boolean(),
  }),
  spotsLeft: z.number().int().nullable(),
  goingHeadcount: count,
  myUnits: z.array(
    z.object({
      unitId: uuid,
      label: z.string(),
      rsvp: z
        .object({
          rsvpId: uuid,
          status: eventRsvpStatusSchema,
          headcount: count,
          version,
          netChargePaise: paise,
        })
        .nullable(),
      canRsvp: z.boolean(),
    }),
  ),
  billingEnabled: z.boolean(),
});

export type EventAdminList = z.infer<typeof eventAdminListSchema>;
export type EventAdminDetail = z.infer<typeof eventAdminGetSchema>;
export type EventBlockOption = z.infer<
  typeof eventBlockOptionsSchema
>['blocks'][number];
export type EventMemberList = z.infer<typeof eventMemberListSchema>;
export type EventMemberListItem = EventMemberList['items'][number];
export type EventUpdateResult = z.infer<typeof eventUpdateResultSchema>;
export type EventMemberDetail = z.infer<typeof eventMemberGetSchema>;
export type EventMemberUnit = EventMemberDetail['myUnits'][number];
