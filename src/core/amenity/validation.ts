// Validate recurring exclusive amenity slots, fee snapshots and resident booking requests.
import { z } from 'zod';
import { nonnegativeRupeesSchema, rupeesSchema } from '../billing/validation';
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid local time.');
const timestamp = z.iso.datetime({ offset: true });
export const amenityMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const AMENITY_CALENDAR_IDENTITIES = [
  'availability_only',
  'booker_name',
  'booker_name_and_unit',
] as const;
export const amenityCalendarIdentitySchema = z.enum(
  AMENITY_CALENDAR_IDENTITIES,
);
export const DEFAULT_AMENITY_SETTINGS = {
  resident_calendar_identity: 'availability_only',
  deposit_confirmation_policy: 'per_amenity',
} as const;
export const amenitySettingsSchema = z
  .object({
    resident_calendar_identity: amenityCalendarIdentitySchema.optional(),
    deposit_confirmation_policy: z
      .enum(['per_amenity', 'immediate'])
      .optional(),
  })
  .strict();
export const amenityCalendarVisibilityInputSchema = z
  .object({ identity: amenityCalendarIdentitySchema })
  .strict();

export const recurringSlotSchema = z
  .object({ weekday: z.number().int().min(0).max(6), start: time, end: time })
  .strict()
  .refine(
    (v) => v.end > v.start,
    'A slot must end after it starts on the same day.',
  );
export const amenityInputSchema = z
  .object({
    amenityId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(120),
    capacity: z.number().int().min(1).max(10000),
    feeRupees: nonnegativeRupeesSchema,
    depositRupees: nonnegativeRupeesSchema,
    depositRequired: z.boolean(),
    rules: z.string().trim().max(5000),
    active: z.boolean(),
    slots: z.array(recurringSlotSchema).min(1).max(100),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.amenityId === null) !== (v.expectedUpdatedAt === null))
      ctx.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the amenity before editing.',
      });
    for (let i = 0; i < v.slots.length; i++)
      for (let j = i + 1; j < v.slots.length; j++) {
        const a = v.slots[i]!;
        const b = v.slots[j]!;
        if (a.weekday === b.weekday && a.start < b.end && b.start < a.end) {
          ctx.addIssue({
            code: 'custom',
            path: ['slots'],
            message: 'Recurring slots on the same weekday must not overlap.',
          });
          return;
        }
      }
  });
export const amenityBookingInputSchema = z
  .object({
    amenityId: z.uuid(),
    slotId: z.uuid(),
    date: z.iso.date(),
    unitId: z.uuid(),
    guestCount: z.number().int().min(1).max(10000),
    rulesAccepted: z.boolean(),
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict();
export const amenityCancelInputSchema = z
  .object({
    bookingId: z.uuid(),
    reason: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();

export const amenityDepositPolicyInputSchema = z
  .object({ policy: z.enum(['per_amenity', 'immediate']) })
  .strict();

export const amenityDepositOverrideInputSchema = z
  .object({
    bookingId: z.uuid(),
    amountRupees: rupeesSchema,
    reason: z.string().trim().min(1).max(500),
    clientRequestId: z.uuid(),
  })
  .strict();

export const amenityDepositEventInputSchema = z
  .object({
    bookingId: z.uuid(),
    kind: z.enum(['receipt', 'refund', 'deduction']),
    amountRupees: rupeesSchema,
    eventDate: z.iso.date(),
    accountId: z.uuid().nullable(),
    reference: z.string().trim().max(120).nullable(),
    reason: z.string().trim().max(500).nullable(),
    evidencePath: z.string().max(500).nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.kind === 'receipt' || value.kind === 'refund') &&
      value.accountId === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['accountId'],
        message: 'Choose an active cash or bank account.',
      });
    }
    if (
      value.kind !== 'receipt' &&
      (!value.reason || value.reason.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Enter a reason.',
      });
    }
    if (value.kind === 'deduction' && value.evidencePath === null) {
      context.addIssue({
        code: 'custom',
        path: ['evidencePath'],
        message: 'Upload private deduction evidence.',
      });
    }
  });

export const amenityDepositVoidInputSchema = z
  .object({
    eventId: z.uuid(),
    reason: z.string().trim().min(1).max(500),
    clientRequestId: z.uuid(),
  })
  .strict();

export const AMENITY_DEPOSIT_EVIDENCE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const amenityDepositUploadInputSchema = z
  .object({
    bookingId: z.uuid(),
    contentType: z.enum(AMENITY_DEPOSIT_EVIDENCE_TYPES),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
  })
  .strict();

export const amenityDepositEvidencePathSchema = z
  .string()
  .max(500)
  .regex(
    /^[0-9a-f-]{36}\/amenity-deposits\/[0-9a-f-]{36}\/[0-9a-f-]+\.(jpg|png|pdf)$/i,
  );

export const amenitySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  capacity: z.number().int().positive(),
  fee_paise: z.number().int().nonnegative().safe(),
  deposit_paise: z.number().int().positive().safe().nullable(),
  deposit_required_before_confirmation: z.boolean(),
  rules: z.string(),
  active: z.boolean(),
  updated_at: timestamp,
});
export const amenitySlotSchema = z.object({
  id: z.uuid(),
  amenity_id: z.uuid(),
  weekday: z.number().int().min(0).max(6),
  start: time,
  end: time,
});
export const amenityOccurrenceSchema = z.object({
  slot_id: z.uuid(),
  amenity_id: z.uuid(),
  starts_at: timestamp,
  ends_at: timestamp,
  available: z.boolean(),
});
export const amenityBookingSchema = z.object({
  id: z.uuid(),
  amenity_id: z.uuid(),
  amenity_name: z.string(),
  unit_number: z.string(),
  starts_at: timestamp,
  ends_at: timestamp,
  guest_count: z.number().int(),
  fee_paise: z.number().int().nonnegative().safe(),
  rules_snapshot: z.string(),
  status: z.enum(['awaiting_deposit', 'confirmed', 'cancelled']),
  cancel_reason: z.string().nullable(),
  can_cancel: z.boolean(),
  deposit: z
    .object({
      original_amount_paise: z.number().int().positive().safe(),
      current_amount_paise: z.number().int().positive().safe(),
      required_before_confirmation: z.boolean(),
      version: z.number().int().positive(),
      received_paise: z.number().int().nonnegative().safe(),
      refunded_paise: z.number().int().nonnegative().safe(),
      deducted_paise: z.number().int().nonnegative().safe(),
      held_paise: z.number().int().nonnegative().safe(),
      remaining_paise: z.number().int().nonnegative().safe(),
      can_override: z.boolean(),
      events: z.array(
        z.object({
          id: z.uuid(),
          kind: z.enum([
            'receipt',
            'refund',
            'deduction',
            'terms_change',
            'void',
          ]),
          amount_paise: z.number().int().positive().safe().nullable(),
          event_date: z.iso.date().nullable(),
          account_name: z.string().nullable(),
          evidence_path: z.string().nullable(),
          reason: z.string().nullable(),
          reference: z.string().nullable(),
          voids_event_id: z.uuid().nullable(),
          created_at: timestamp,
          is_voided: z.boolean(),
        }),
      ),
    })
    .nullable(),
});
export const amenityWorkspaceSchema = z.object({
  today: z.iso.date(),
  date: z.iso.date(),
  timezone: z.string(),
  can_manage: z.boolean(),
  can_book: z.boolean(),
  billing_enabled: z.boolean(),
  expense_enabled: z.boolean(),
  deposit_confirmation_policy: z.enum(['per_amenity', 'immediate']),
  amenities: z.array(amenitySchema),
  slots: z.array(amenitySlotSchema),
  occurrences: z.array(amenityOccurrenceSchema),
  units: z.array(z.object({ id: z.uuid(), number: z.string() })),
  expense_accounts: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      account_type: z.enum(['cash', 'bank']),
    }),
  ),
  busy: z.array(
    z
      .object({
        amenity_id: z.uuid(),
        starts_at: timestamp,
        ends_at: timestamp,
      })
      .strict(),
  ),
  bookings: z.array(amenityBookingSchema),
});
export const amenityCalendarSchema = z
  .object({
    month: amenityMonthSchema,
    timezone: z.string().min(1),
    identity_mode: amenityCalendarIdentitySchema,
    items: z.array(
      z
        .object({
          amenity_id: z.uuid(),
          amenity_name: z.string().min(1).max(120),
          starts_at: timestamp,
          ends_at: timestamp,
          booker_name: z.string().max(120).nullable(),
          unit_number: z.string().max(50).nullable(),
          overlap_warning: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export const amenityCalendarSettingsSchema = z
  .object({
    resident_calendar_identity: amenityCalendarIdentitySchema,
    deposit_confirmation_policy: z.enum(['per_amenity', 'immediate']),
    directory_enabled: z.boolean(),
    can_manage: z.boolean(),
  })
  .strict();

export const AMENITY_FACILITY_SOURCE_TYPES = [
  'amenity_booking',
  'asset',
  'amc_visit',
  'service_request',
] as const;
export const amenityFacilitySourceTypeSchema = z.enum(
  AMENITY_FACILITY_SOURCE_TYPES,
);
export const amenityActivityInputSchema = z
  .object({
    sourceType: amenityFacilitySourceTypeSchema,
    sourceId: z.uuid(),
    activityKind: z.enum(['use', 'issue']),
    occurredAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    note: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .transform((value) => (value ? value : null)),
    clientRequestId: z.uuid(),
  })
  .strict();
export const amenityFacilitiesReportSchema = z
  .object({
    timezone: z.string().min(1),
    can_record: z.boolean(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    source_choices: z.array(
      z
        .object({
          source_kind: amenityFacilitySourceTypeSchema,
          source_id: z.uuid(),
          label: z.string().min(1).max(200),
        })
        .strict(),
    ),
    items: z.array(
      z
        .object({
          id: z.uuid(),
          source_kind: amenityFacilitySourceTypeSchema,
          source_id: z.uuid(),
          source_label: z.string().min(1).max(200),
          activity_kind: z.enum(['use', 'issue']),
          event_at: timestamp,
          note: z.string().max(500).nullable(),
          actor_name: z.string().min(1).max(120),
          created_at: timestamp,
        })
        .strict(),
    ),
  })
  .strict();
export type Amenity = z.infer<typeof amenitySchema>;
export type AmenitySlot = z.infer<typeof amenitySlotSchema>;
export type AmenityOccurrence = z.infer<typeof amenityOccurrenceSchema>;
export type AmenityBooking = z.infer<typeof amenityBookingSchema>;
export type AmenityCalendar = z.infer<typeof amenityCalendarSchema>;
export type AmenityCalendarIdentity = z.infer<
  typeof amenityCalendarIdentitySchema
>;
export type AmenityFacilitiesReport = z.infer<
  typeof amenityFacilitiesReportSchema
>;
