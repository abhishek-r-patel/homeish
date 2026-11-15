// Validate Emergency SOS settings, inputs and database responses.
import { z } from 'zod';

export const SOS_RESIDENT_SCOPES = [
  'off',
  'floor',
  'block',
  'society',
] as const;

export const DEFAULT_SOS_SETTINGS = {
  notify_guards: true,
  notify_admins: true,
  notify_committee: false,
  resident_scope: 'off',
} as const;

export const sosSettingsSchema = z
  .object({
    notify_guards: z.boolean().optional(),
    notify_admins: z.boolean().optional(),
    notify_committee: z.boolean().optional(),
    resident_scope: z.enum(SOS_RESIDENT_SCOPES).optional(),
  })
  .strict();

export const SOS_CATEGORIES = ['medical', 'fire', 'security', 'other'] as const;
export const SOS_STATUSES = [
  'raised',
  'acknowledged',
  'closed',
  'cancelled',
] as const;
export const SOS_CLOSE_REASONS = [
  'resolved',
  'false_alarm',
  'duplicate',
  'test',
  'other',
] as const;
export const SOS_NOTE_REQUIRED_REASONS = ['false_alarm', 'other'] as const;
export const SOS_NOTE_MAX = 280;
export const SOS_UPDATE_MAX = 500;
export const SOS_CONTACT_PHONE_PATTERN = /^\+?[0-9]([0-9 -]*[0-9])?$/;

export const sosCategorySchema = z.enum(SOS_CATEGORIES);
export const sosStatusSchema = z.enum(SOS_STATUSES);
export const sosCloseReasonSchema = z.enum(SOS_CLOSE_REASONS);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value ? value : null));

export const sosSettingsInputSchema = z
  .object({
    notifyGuards: z.boolean(),
    notifyAdmins: z.boolean(),
    notifyCommittee: z.boolean(),
    residentScope: z.enum(SOS_RESIDENT_SCOPES),
  })
  .strict()
  .refine(
    (input) =>
      input.notifyGuards || input.notifyAdmins || input.notifyCommittee,
    {
      path: ['notifyGuards'],
      message: 'Keep at least one responder group notified.',
    },
  );

export const sosRaiseInputSchema = z
  .object({
    unitId: z.uuid().nullable(),
    category: sosCategorySchema,
    note: optionalText(
      SOS_NOTE_MAX,
      `Keep the note under ${SOS_NOTE_MAX} characters.`,
    ),
    clientRequestId: z.uuid(),
  })
  .strict();

export const sosAlertInputSchema = z.object({ alertId: z.uuid() }).strict();

export const sosUpdateInputSchema = z
  .object({
    alertId: z.uuid(),
    note: z
      .string()
      .trim()
      .min(1, 'Enter an update.')
      .max(
        SOS_UPDATE_MAX,
        `Keep the update under ${SOS_UPDATE_MAX} characters.`,
      ),
  })
  .strict();

export function sosCloseNoteRequired(reason: SosCloseReason): boolean {
  return (SOS_NOTE_REQUIRED_REASONS as readonly string[]).includes(reason);
}

export const sosCloseInputSchema = z
  .object({
    alertId: z.uuid(),
    reason: sosCloseReasonSchema,
    note: optionalText(
      SOS_UPDATE_MAX,
      `Keep the note under ${SOS_UPDATE_MAX} characters.`,
    ),
  })
  .strict()
  .refine((input) => !sosCloseNoteRequired(input.reason) || input.note, {
    path: ['note'],
    message: 'Explain why this alert is being closed.',
  });

export const sosContactInputSchema = z
  .object({
    contactId: z.uuid().nullable(),
    label: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(60, 'Keep the name under 60 characters.'),
    phone: z
      .string()
      .trim()
      .min(2, 'Enter a phone number.')
      .max(20, 'Keep the number under 20 characters.')
      .regex(
        SOS_CONTACT_PHONE_PATTERN,
        'Use digits, spaces, hyphens and an optional leading +.',
      ),
    sortOrder: z.number().int().min(0).max(999),
  })
  .strict();

export const sosContactArchiveInputSchema = z
  .object({ contactId: z.uuid(), archived: z.boolean() })
  .strict();

export const sosPageInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export const sosHistorySearchSchema = z
  .object({
    limit: z.coerce
      .number()
      .pipe(
        z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
      )
      .default(25),
    offset: z.coerce
      .number()
      .pipe(sosPageInputSchema.shape.offset.unwrap())
      .default(0),
  })
  .strict();

const timestamp = z.iso.datetime({ offset: true });

export const sosEventSchema = z
  .object({
    id: z.uuid(),
    action: z.enum([
      'raised',
      'acknowledged',
      'updated',
      'closed',
      'cancelled',
    ]),
    note: z.string().nullable(),
    actor_name: z.string(),
    created_at: timestamp,
  })
  .strict();

export const sosAlertSchema = z
  .object({
    id: z.uuid(),
    unit_id: z.uuid().nullable(),
    unit_label: z.string().nullable(),
    category: sosCategorySchema,
    note: z.string().nullable(),
    status: sosStatusSchema,
    raised_role: z.enum(['resident', 'guard']),
    raised_at: timestamp,
    raised_by_name: z.string(),
    is_mine: z.boolean(),
    can_cancel: z.boolean(),
    can_respond: z.boolean(),
    acknowledged_at: timestamp.nullable(),
    acknowledged_by_name: z.string().nullable(),
    closed_at: timestamp.nullable(),
    close_reason: z
      .enum([...SOS_CLOSE_REASONS, 'raised_by_mistake'])
      .nullable(),
    close_note: z.string().nullable(),
    events: z.array(sosEventSchema),
  })
  .strict();

export const sosContactSchema = z
  .object({
    id: z.uuid(),
    label: z.string().min(1),
    phone: z.string().min(1),
    sort_order: z.number().int(),
    archived: z.boolean(),
  })
  .strict();

const sosUnitOptionSchema = z
  .object({ id: z.uuid(), label: z.string() })
  .strict();

export const sosWorkspaceSchema = z
  .object({
    timezone: z.string().min(1),
    unit_label: z.string().min(1),
    can_write: z.boolean(),
    can_raise: z.boolean(),
    can_respond: z.boolean(),
    can_manage: z.boolean(),
    settings: z
      .object({
        notify_guards: z.boolean(),
        notify_admins: z.boolean(),
        notify_committee: z.boolean(),
        resident_scope: z.enum(SOS_RESIDENT_SCOPES),
      })
      .strict(),
    my_units: z.array(sosUnitOptionSchema),
    units: z.array(sosUnitOptionSchema),
    open: z.array(sosAlertSchema),
    history: z
      .object({
        items: z.array(sosAlertSchema),
        total: z.number().int().nonnegative(),
        limit: z.number().int().min(1).max(100),
        offset: z.number().int().nonnegative(),
      })
      .strict(),
    contacts: z.array(sosContactSchema),
  })
  .strict();

export const sosBannerAlertSchema = z
  .object({
    id: z.uuid(),
    society_id: z.uuid(),
    society_name: z.string(),
    category: sosCategorySchema,
    status: z.enum(['raised', 'acknowledged']),
    raised_role: z.enum(['resident', 'guard']),
    unit_label: z.string().nullable(),
    raised_at: timestamp,
    audience: z.enum(['guard', 'admin', 'committee', 'resident']),
    note: z.string().nullable(),
  })
  .strict();

export const sosBannerAlertsSchema = z.array(sosBannerAlertSchema).max(20);

export type SosCategory = z.infer<typeof sosCategorySchema>;
export type SosStatus = z.infer<typeof sosStatusSchema>;
export type SosCloseReason = z.infer<typeof sosCloseReasonSchema>;
export type SosResidentScope = (typeof SOS_RESIDENT_SCOPES)[number];
export type SosAlert = z.infer<typeof sosAlertSchema>;
export type SosEvent = z.infer<typeof sosEventSchema>;
export type SosContact = z.infer<typeof sosContactSchema>;
export type SosWorkspace = z.infer<typeof sosWorkspaceSchema>;
export type SosBannerAlert = z.infer<typeof sosBannerAlertSchema>;
