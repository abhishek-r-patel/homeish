// Validate P53 member contact log input and read models, and the communication dashboard figures.
import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date('Enter a valid date.');
const optionalId = z
  .union([z.literal(''), z.uuid(), z.null()])
  .transform((value) => value || null);
const optionalDate = z
  .union([z.literal(''), isoDate, z.null()])
  .transform((value) => value || null);

export const CONTACT_SUMMARY_MAX = 300;
export const CONTACT_LOG_HREF = '/admin/contact-log';
export const COMMUNICATION_HREF = '/admin/communication';

export const CONTACT_TYPES = [
  'query',
  'complaint',
  'request',
  'information',
  'feedback',
  'other',
] as const;
export const CONTACT_CHANNELS = [
  'in_person',
  'phone',
  'email',
  'letter',
  'whatsapp',
  'other',
] as const;
export const CONTACT_DIRECTIONS = ['incoming', 'outgoing'] as const;
export const CONTACT_STATUSES = ['open', 'follow_up', 'closed'] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export type ContactDirection = (typeof CONTACT_DIRECTIONS)[number];
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_TYPE_LABELS: Readonly<Record<ContactType, string>> = {
  query: 'Query',
  complaint: 'Complaint',
  request: 'Request',
  information: 'Information',
  feedback: 'Feedback',
  other: 'Other',
};
export const CONTACT_CHANNEL_LABELS: Readonly<Record<ContactChannel, string>> =
  {
    in_person: 'In person',
    phone: 'Phone',
    email: 'Email',
    letter: 'Letter',
    whatsapp: 'WhatsApp',
    other: 'Other',
  };
export const CONTACT_DIRECTION_LABELS: Readonly<
  Record<ContactDirection, string>
> = { incoming: 'From the member', outgoing: 'To the member' };
export const CONTACT_STATUS_LABELS: Readonly<Record<ContactStatus, string>> = {
  open: 'Open',
  follow_up: 'Follow-up',
  closed: 'Closed',
};

export const contactLogEntrySchema = z.object({
  id: z.uuid(),
  contact_on: z.iso.date(),
  unit_id: z.uuid().nullable(),
  unit_label: z.string().nullable(),
  contact_type: z.enum(CONTACT_TYPES),
  channel: z.enum(CONTACT_CHANNELS),
  direction: z.enum(CONTACT_DIRECTIONS),
  summary: z.string(),
  handled_by: z.uuid(),
  handled_by_name: z.string().nullable(),
  follow_up_on: z.iso.date().nullable(),
  status: z.enum(CONTACT_STATUSES),
  closed_at: timestamp.nullable(),
  service_request_id: z.uuid().nullable(),
  days_open: z.number().int().nonnegative(),
  follow_up_overdue: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type ContactLogEntry = z.infer<typeof contactLogEntrySchema>;

const optionSchema = z.object({ id: z.uuid(), label: z.string() });
export type ContactLogOption = z.infer<typeof optionSchema>;

export const contactLogPageSchema = z.object({
  can_manage: z.boolean().default(false),
  logs: z.array(contactLogEntrySchema),
  handlers: z.array(z.object({ id: z.uuid(), name: z.string().nullable() })),
  units: z.array(optionSchema),
  requests: z.array(optionSchema),
});
export type ContactLogPage = z.infer<typeof contactLogPageSchema>;

export const CONTACT_LOG_FILTERS = ['all', 'open', 'closed'] as const;
export type ContactLogFilter = (typeof CONTACT_LOG_FILTERS)[number];

export function parseContactLogFilter(value: unknown): ContactLogFilter {
  return CONTACT_LOG_FILTERS.find((filter) => filter === value) ?? 'all';
}

export const contactLogSaveInputSchema = z
  .object({
    logId: z.uuid().nullable(),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid().nullable(),
    contactOn: isoDate,
    unitId: optionalId,
    contactType: z.enum(CONTACT_TYPES, 'Choose a contact type.'),
    channel: z.enum(CONTACT_CHANNELS, 'Choose how the member made contact.'),
    direction: z.enum(CONTACT_DIRECTIONS, 'Choose who started the contact.'),
    summary: z
      .string()
      .trim()
      .min(1, 'Enter a short summary.')
      .max(
        CONTACT_SUMMARY_MAX,
        `Keep the summary within ${CONTACT_SUMMARY_MAX} characters.`,
      ),
    handledBy: z.uuid('Choose who handled the contact.'),
    followUpOn: optionalDate,
    status: z.enum(CONTACT_STATUSES, 'Choose a status.'),
    serviceRequestId: optionalId,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.logId === null && input.clientRequestId === null) {
      context.addIssue({
        code: 'custom',
        path: ['form'],
        message: 'Refresh the page and retry.',
      });
    }
    if (input.logId !== null && input.expectedUpdatedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['form'],
        message: 'Refresh the page and retry.',
      });
    }
    if (input.followUpOn !== null && input.followUpOn < input.contactOn) {
      context.addIssue({
        code: 'custom',
        path: ['followUpOn'],
        message: 'The follow-up date cannot be before the contact date.',
      });
    }
    if (input.status === 'follow_up' && input.followUpOn === null) {
      context.addIssue({
        code: 'custom',
        path: ['followUpOn'],
        message: 'Choose a follow-up date.',
      });
    }
  });
export type ContactLogSaveInput = z.input<typeof contactLogSaveInputSchema>;

const count = z.number().int().nonnegative();

export const communicationDashboardSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  notices: z
    .object({ posted: count, removed: count, planned_now: count })
    .nullable(),
  meetings: z.object({ notices_issued: count }).nullable(),
  events: z.object({ published: count }).nullable(),
  sos: z.object({ raised: count }).nullable(),
  requests: z
    .object({
      received: count,
      resolved: count,
      avg_days: z.number().nonnegative().nullable(),
    })
    .nullable(),
  contact_log: z.object({
    logged: count,
    closed: count,
    open_now: count,
    follow_up_overdue: count,
  }),
});
export type CommunicationDashboard = z.infer<
  typeof communicationDashboardSchema
>;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Returns the requested YYYY-MM month, falling back to the current month for missing, invalid or future values. */
export function parseDashboardMonth(value: unknown, currentMonth: string) {
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value))
    return currentMonth;
  return value > currentMonth ? currentMonth : value;
}
