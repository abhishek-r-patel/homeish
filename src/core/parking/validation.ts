// Validate Parking settings, form input and the database read models.
import { z } from 'zod';
import { MAX_FILE_BYTES } from '../files/constraints';

export const PARKING_PHOTO_RETENTION_MIN_DAYS = 1;
export const PARKING_PHOTO_RETENTION_MAX_DAYS = 90;
export const PARKING_PASS_MAX_HOURS = 24;
export const PARKING_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;

export const DEFAULT_PARKING_SETTINGS = {
  photo_retention_days: 3,
} as const;

export const parkingSettingsSchema = z
  .object({
    photo_retention_days: z
      .number()
      .int()
      .min(PARKING_PHOTO_RETENTION_MIN_DAYS)
      .max(PARKING_PHOTO_RETENTION_MAX_DAYS)
      .optional(),
  })
  .strict();

export const PARKING_SLOT_TYPES = [
  'car',
  'two_wheeler',
  'ev',
  'visitor',
] as const;
export const PARKING_REQUEST_SLOT_TYPES = ['car', 'two_wheeler', 'ev'] as const;
export const parkingSlotTypeSchema = z.enum(PARKING_SLOT_TYPES);
export const parkingRequestSlotTypeSchema = z.enum(PARKING_REQUEST_SLOT_TYPES);

/** Mirrors private.parking_normalize_vehicle: drop spaces and hyphens, upper-case. */
export function normalizeVehicleNumber(value: string) {
  return value.trim().replace(/[\s-]/g, '').toUpperCase();
}

const vehicleNumber = z
  .string()
  .max(40)
  .transform(normalizeVehicleNumber)
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z0-9]{4,16}$/,
        'Enter 4–16 letters or digits, for example MH01AB1234.',
      ),
  );
const optionalVehicleNumber = z
  .string()
  .max(40)
  .nullable()
  .transform((value) =>
    value === null || normalizeVehicleNumber(value) === '' ? null : value,
  )
  .pipe(vehicleNumber.nullable());

function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value ? value : null));
}

const version = z.number().int().min(1).max(2_147_483_647);
const timestamp = z.iso.datetime({ offset: true });

export const parkingSettingsInputSchema = z
  .object({
    photoRetentionDays: z
      .number()
      .int()
      .min(
        PARKING_PHOTO_RETENTION_MIN_DAYS,
        `Keep photos for at least ${PARKING_PHOTO_RETENTION_MIN_DAYS} day.`,
      )
      .max(
        PARKING_PHOTO_RETENTION_MAX_DAYS,
        `Keep photos for at most ${PARKING_PHOTO_RETENTION_MAX_DAYS} days.`,
      ),
  })
  .strict();

export const parkingSlotInputSchema = z
  .object({
    slotId: z.uuid().nullable(),
    label: z
      .string()
      .trim()
      .min(1, 'Enter a slot label or number.')
      .max(40, 'Keep the slot label within 40 characters.'),
    slotType: parkingSlotTypeSchema,
    locationNote: optionalText(
      200,
      'Keep the location note within 200 characters.',
    ),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    ({ slotId, expectedVersion }) =>
      (slotId === null) === (expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the slot before editing it.',
    },
  );

export const parkingSlotArchiveInputSchema = z
  .object({ slotId: z.uuid(), expectedVersion: version })
  .strict();

export const parkingRequestInputSchema = z
  .object({
    unitId: z.uuid(),
    slotType: parkingRequestSlotTypeSchema,
    note: optionalText(300, 'Keep the note within 300 characters.'),
    clientRequestId: z.uuid(),
  })
  .strict();

export const parkingRequestCancelInputSchema = z
  .object({ waitlistRequestId: z.uuid() })
  .strict();

export const parkingAllocateInputSchema = z
  .object({
    slotId: z.uuid(),
    unitId: z.uuid(),
    skipReason: optionalText(500, 'Keep the reason within 500 characters.'),
  })
  .strict();

export const parkingAllocationEndInputSchema = z
  .object({ allocationId: z.uuid() })
  .strict();

export const parkingVehicleLinkInputSchema = z
  .object({ allocationId: z.uuid(), vehicleId: z.uuid(), linked: z.boolean() })
  .strict();

export const parkingPassInputSchema = z
  .object({
    unitId: z.uuid(),
    slotId: z.uuid().nullable(),
    startsAt: timestamp,
    endsAt: timestamp,
    visitorName: z
      .string()
      .trim()
      .min(1, 'Enter the visitor name.')
      .max(120, 'Keep the visitor name within 120 characters.'),
    vehicleNumber: optionalVehicleNumber,
    visitorEntryId: z.uuid().nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    const duration = Date.parse(input.endsAt) - Date.parse(input.startsAt);
    if (duration <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Choose an end time after the start time.',
      });
    } else if (duration > PARKING_PASS_MAX_HOURS * 3_600_000) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: `A visitor pass can last at most ${PARKING_PASS_MAX_HOURS} hours.`,
      });
    }
  });

export const parkingPassCancelInputSchema = z
  .object({ passId: z.uuid() })
  .strict();

export const parkingPhotoPathSchema = z
  .string()
  .max(500)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/,
  );

export const parkingPhotoUploadInputSchema = z
  .object({
    contentType: z.enum(PARKING_PHOTO_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  })
  .strict();

export const parkingReportInputSchema = z
  .object({
    slotId: z.uuid().nullable(),
    vehicleNumber: optionalVehicleNumber,
    note: optionalText(500, 'Keep the note within 500 characters.'),
    photoPath: parkingPhotoPathSchema.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    ({ slotId, vehicleNumber }) => slotId !== null || vehicleNumber !== null,
    {
      path: ['vehicleNumber'],
      message: 'Choose a slot or enter a vehicle number.',
    },
  );

export const parkingReportResolveInputSchema = z
  .object({
    reportId: z.uuid(),
    resolutionNote: optionalText(500, 'Keep the note within 500 characters.'),
  })
  .strict();

export const parkingGuardQuerySchema = optionalText(
  40,
  'Enter a slot label or vehicle number up to 40 characters.',
);

const unitSchema = z.object({ id: z.uuid(), number: z.string() }).strict();

export const parkingVehicleSchema = z
  .object({
    vehicle_id: z.uuid(),
    registration_number: z.string(),
    vehicle_type: z.string(),
    linked: z.boolean(),
    linked_elsewhere: z.boolean(),
  })
  .strict();

export const parkingAllocationSchema = z
  .object({
    id: z.uuid(),
    slot_id: z.uuid(),
    slot_label: z.string(),
    slot_type: parkingSlotTypeSchema,
    location_note: z.string().nullable(),
    unit_id: z.uuid(),
    unit_number: z.string(),
    started_at: timestamp,
    skip_reason: z.string().nullable(),
    vehicles: z.array(parkingVehicleSchema),
  })
  .strict();

export const parkingPassSchema = z
  .object({
    id: z.uuid(),
    slot_id: z.uuid(),
    slot_label: z.string(),
    unit_id: z.uuid(),
    unit_number: z.string(),
    visitor_name: z.string(),
    vehicle_number: z.string().nullable(),
    visitor_entry_id: z.uuid().nullable(),
    starts_at: timestamp,
    ends_at: timestamp,
    status: z.enum(['active', 'cancelled']),
  })
  .strict();

export const parkingReportSchema = z
  .object({
    id: z.uuid(),
    slot_id: z.uuid().nullable(),
    slot_label: z.string().nullable(),
    vehicle_number: z.string().nullable(),
    note: z.string().nullable(),
    status: z.enum(['open', 'resolved']),
    reporter_role: z.enum(['guard', 'resident']),
    matched_unit_number: z.string().nullable(),
    photo_path: parkingPhotoPathSchema.nullable(),
    resolution_note: z.string().nullable(),
    created_at: timestamp,
    resolved_at: timestamp.nullable(),
    is_mine: z.boolean(),
  })
  .strict();

const requestStatusSchema = z.enum(['waiting', 'fulfilled', 'cancelled']);
const slotChoiceSchema = z
  .object({ id: z.uuid(), label: z.string(), slot_type: parkingSlotTypeSchema })
  .strict();

export const parkingResidentWorkspaceSchema = z
  .object({
    directory_enabled: z.boolean(),
    visitor_enabled: z.boolean(),
    units: z.array(unitSchema),
    allocations: z.array(parkingAllocationSchema),
    requests: z.array(
      z
        .object({
          id: z.uuid(),
          unit_id: z.uuid(),
          unit_number: z.string(),
          slot_type: parkingRequestSlotTypeSchema,
          note: z.string().nullable(),
          status: requestStatusSchema,
          created_at: timestamp,
          closed_at: timestamp.nullable(),
          queue_position: z.number().int().min(1).nullable(),
        })
        .strict(),
    ),
    passes: z.array(parkingPassSchema),
    visitor_slots: z.array(
      z
        .object({
          id: z.uuid(),
          label: z.string(),
          location_note: z.string().nullable(),
        })
        .strict(),
    ),
    visitor_entries: z.array(
      z
        .object({
          id: z.uuid(),
          unit_id: z.uuid(),
          visitor_name: z.string(),
          status: z.string(),
          created_at: timestamp,
        })
        .strict(),
    ),
    report_slots: z.array(slotChoiceSchema),
    reports: z.array(parkingReportSchema),
  })
  .strict();

export const parkingAdminWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    directory_enabled: z.boolean(),
    visitor_enabled: z.boolean(),
    settings: z
      .object({
        photo_retention_days: z
          .number()
          .int()
          .min(PARKING_PHOTO_RETENTION_MIN_DAYS)
          .max(PARKING_PHOTO_RETENTION_MAX_DAYS),
      })
      .strict(),
    slots: z.array(
      z
        .object({
          id: z.uuid(),
          label: z.string(),
          slot_type: parkingSlotTypeSchema,
          location_note: z.string().nullable(),
          archived_at: timestamp.nullable(),
          version,
          allocation: parkingAllocationSchema.nullable(),
        })
        .strict(),
    ),
    units: z.array(unitSchema),
    queues: z.array(
      z
        .object({
          id: z.uuid(),
          unit_id: z.uuid(),
          unit_number: z.string(),
          slot_type: parkingRequestSlotTypeSchema,
          note: z.string().nullable(),
          created_at: timestamp,
          queue_position: z.number().int().min(1),
        })
        .strict(),
    ),
    passes: z.array(parkingPassSchema),
    reports: z.array(parkingReportSchema),
  })
  .strict();

export const parkingGuardBoardSchema = z
  .object({
    visitor_enabled: z.boolean(),
    passes: z.array(parkingPassSchema),
    slots: z.array(slotChoiceSchema),
    query: z.string().nullable(),
    matches: z.array(
      z
        .object({
          slot_label: z.string().nullable(),
          slot_type: parkingSlotTypeSchema.nullable(),
          unit_number: z.string().nullable(),
          vehicle_numbers: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

export type ParkingSlotType = z.infer<typeof parkingSlotTypeSchema>;
export type ParkingRequestSlotType = z.infer<
  typeof parkingRequestSlotTypeSchema
>;
export type ParkingAllocation = z.infer<typeof parkingAllocationSchema>;
export type ParkingPass = z.infer<typeof parkingPassSchema>;
export type ParkingReport = z.infer<typeof parkingReportSchema>;
export type ParkingResidentWorkspace = z.infer<
  typeof parkingResidentWorkspaceSchema
>;
export type ParkingAdminWorkspace = z.infer<typeof parkingAdminWorkspaceSchema>;
export type ParkingGuardBoard = z.infer<typeof parkingGuardBoardSchema>;
