// Validate Guard Patrol settings, form input and the database read models.
import { z } from 'zod';
import { MAX_FILE_BYTES } from '../files/constraints';

export const PATROL_PHOTO_RETENTION_MIN_DAYS = 30;
export const PATROL_PHOTO_RETENTION_MAX_DAYS = 365;

export const DEFAULT_PATROL_SETTINGS = {
  photo_retention_days: 90,
} as const;

export const patrolSettingsSchema = z
  .object({
    photo_retention_days: z
      .number()
      .int()
      .min(PATROL_PHOTO_RETENTION_MIN_DAYS)
      .max(PATROL_PHOTO_RETENTION_MAX_DAYS)
      .optional(),
  })
  .strict();

/** Typed codes avoid 0/O and 1/I so guards can read them off a sticker. */
export const PATROL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PATROL_CODE_LENGTH = 6;
/** The QR payload is a fixed prefix plus the non-secret typed code, never a URL. */
export const PATROL_QR_PREFIX = 'homeish-patrol:';
export const PATROL_MAX_PHOTOS = 3;
export const PATROL_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;
export const PATROL_MAX_SCHEDULE_CHECKPOINTS = 50;
export const PATROL_HANDOVER_DAYS = 7;

const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;

/** Mirrors public.patrol_scan: accept the QR payload or the typed code, ignoring spaces and hyphens. */
export function normalizePatrolCode(value: string): string | null {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.toLowerCase().startsWith(PATROL_QR_PREFIX)
    ? trimmed.slice(PATROL_QR_PREFIX.length)
    : trimmed;
  const code = withoutPrefix.replace(/[\s-]/g, '').toUpperCase();
  return codePattern.test(code) ? code : null;
}

export function patrolQrPayload(code: string) {
  return `${PATROL_QR_PREFIX}${code}`;
}

export const PATROL_INCIDENT_CATEGORIES = [
  'suspicious_activity',
  'unauthorised_entry',
  'theft',
  'fire_safety',
  'medical',
  'property_damage',
  'dispute',
  'other',
] as const;
export const PATROL_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const patrolCategorySchema = z.enum(PATROL_INCIDENT_CATEGORIES);
export const patrolSeveritySchema = z.enum(PATROL_SEVERITIES);

function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value ? value : null));
}

function requiredText(max: number, empty: string, tooLong: string) {
  return z.string().trim().min(1, empty).max(max, tooLong);
}

const version = z.number().int().min(1).max(2_147_483_647);
const timestamp = z.iso.datetime({ offset: true });
const clockTime = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Choose a time.');

/** Minutes from 00:00 for an HH:MM clock time. */
export function clockMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Shift length in minutes; an end at or before the start runs past midnight. */
export function shiftLengthMinutes(start: string, end: string) {
  const difference = clockMinutes(end) - clockMinutes(start);
  return difference > 0 ? difference : difference + 1440;
}

export const patrolSettingsInputSchema = z
  .object({
    photoRetentionDays: z
      .number()
      .int()
      .min(
        PATROL_PHOTO_RETENTION_MIN_DAYS,
        `Keep photos for at least ${PATROL_PHOTO_RETENTION_MIN_DAYS} days.`,
      )
      .max(
        PATROL_PHOTO_RETENTION_MAX_DAYS,
        `Keep photos for at most ${PATROL_PHOTO_RETENTION_MAX_DAYS} days.`,
      ),
  })
  .strict();

export const patrolCheckpointInputSchema = z
  .object({
    checkpointId: z.uuid().nullable(),
    name: requiredText(
      80,
      'Enter a checkpoint name.',
      'Keep the checkpoint name within 80 characters.',
    ),
    locationNote: optionalText(
      200,
      'Keep the location note within 200 characters.',
    ),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    ({ checkpointId, expectedVersion }) =>
      (checkpointId === null) === (expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the checkpoint before editing it.',
    },
  );

export const patrolCheckpointActiveInputSchema = z
  .object({
    checkpointId: z.uuid(),
    active: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const patrolScheduleInputSchema = z
  .object({
    scheduleId: z.uuid().nullable(),
    name: requiredText(
      80,
      'Enter a schedule name.',
      'Keep the schedule name within 80 characters.',
    ),
    shiftStart: clockTime,
    shiftEnd: clockTime,
    intervalMinutes: z
      .number()
      .int()
      .min(15, 'Rounds must be at least 15 minutes apart.')
      .max(720, 'Rounds must be at most 12 hours apart.'),
    graceMinutes: z
      .number()
      .int()
      .min(0, 'The grace period cannot be negative.')
      .max(120, 'Keep the grace period within 120 minutes.'),
    checkpointIds: z
      .array(z.uuid())
      .min(1, 'Choose at least one checkpoint.')
      .max(
        PATROL_MAX_SCHEDULE_CHECKPOINTS,
        `Choose at most ${PATROL_MAX_SCHEDULE_CHECKPOINTS} checkpoints.`,
      )
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Choose each checkpoint once.',
      }),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.scheduleId === null) !== (input.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh the schedule before editing it.',
      });
    }
    if (input.shiftStart === input.shiftEnd) {
      context.addIssue({
        code: 'custom',
        path: ['shiftEnd'],
        message: 'Choose a shift end different from the start.',
      });
      return;
    }
    if (
      input.intervalMinutes >
      shiftLengthMinutes(input.shiftStart, input.shiftEnd)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['intervalMinutes'],
        message: 'The round interval must fit inside the shift.',
      });
    }
    if (input.graceMinutes > input.intervalMinutes) {
      context.addIssue({
        code: 'custom',
        path: ['graceMinutes'],
        message: 'Keep the grace period within the round interval.',
      });
    }
  });

export const patrolScheduleActiveInputSchema = z
  .object({
    scheduleId: z.uuid(),
    active: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const patrolScanInputSchema = z
  .object({
    code: z
      .string()
      .max(80)
      .transform((value, context) => {
        const code = normalizePatrolCode(value);
        if (!code) {
          context.addIssue({
            code: 'custom',
            message: 'Enter the 6-character code printed under the QR code.',
          });
          return z.NEVER;
        }
        return code;
      }),
    method: z.enum(['qr', 'typed']),
    clientRequestId: z.uuid(),
  })
  .strict();

export const patrolPhotoPathSchema = z
  .string()
  .max(500)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/incidents\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/,
  );

export const patrolPhotoUploadInputSchema = z
  .object({
    contentType: z.enum(PATROL_PHOTO_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  })
  .strict();

export const patrolIncidentInputSchema = z
  .object({
    category: patrolCategorySchema,
    severity: patrolSeveritySchema,
    description: requiredText(
      1000,
      'Describe what happened.',
      'Keep the description within 1000 characters.',
    ),
    location: optionalText(200, 'Keep the location within 200 characters.'),
    photoPaths: z
      .array(patrolPhotoPathSchema)
      .max(PATROL_MAX_PHOTOS, `Attach at most ${PATROL_MAX_PHOTOS} photos.`)
      .refine((paths) => new Set(paths).size === paths.length, {
        message: 'Attach each photo once.',
      }),
    clientRequestId: z.uuid(),
  })
  .strict();

export const patrolIncidentNoteInputSchema = z
  .object({
    incidentId: z.uuid(),
    body: requiredText(
      1000,
      'Write a follow-up note.',
      'Keep the note within 1000 characters.',
    ),
  })
  .strict();

export const patrolIncidentCloseInputSchema = z
  .object({
    incidentId: z.uuid(),
    resolution: requiredText(
      1000,
      'Write how the incident was resolved.',
      'Keep the resolution within 1000 characters.',
    ),
  })
  .strict();

export const patrolHandoverInputSchema = z
  .object({
    body: requiredText(
      1000,
      'Write the handover note.',
      'Keep the handover note within 1000 characters.',
    ),
    clientRequestId: z.uuid(),
  })
  .strict();

export const patrolHandoverAcknowledgeInputSchema = z
  .object({ noteId: z.uuid() })
  .strict();

export const patrolScheduleSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    shift_start: clockTime,
    shift_end: clockTime,
    interval_minutes: z.number().int().min(15).max(720),
    grace_minutes: z.number().int().min(0).max(120),
    active: z.boolean(),
    effective_from: timestamp,
    version,
    checkpoints: z.array(
      z.object({ checkpoint_id: z.uuid(), included_at: timestamp }).strict(),
    ),
  })
  .strict();

export const patrolScanSchema = z
  .object({
    id: z.uuid(),
    checkpoint_id: z.uuid(),
    method: z.enum(['qr', 'typed']),
    scanned_at: timestamp,
    scanned_by_name: z.string(),
    is_mine: z.boolean(),
  })
  .strict();

export const patrolIncidentSchema = z
  .object({
    id: z.uuid(),
    category: patrolCategorySchema,
    severity: patrolSeveritySchema,
    description: z.string(),
    location: z.string().nullable(),
    status: z.enum(['open', 'closed']),
    resolution: z.string().nullable(),
    reported_by_name: z.string(),
    created_at: timestamp,
    closed_at: timestamp.nullable(),
    closed_by_name: z.string().nullable(),
    photo_paths: z.array(patrolPhotoPathSchema).max(PATROL_MAX_PHOTOS),
    notes: z.array(
      z
        .object({
          id: z.uuid(),
          body: z.string(),
          created_at: timestamp,
          author_name: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export const patrolHandoverSchema = z
  .object({
    id: z.uuid(),
    body: z.string(),
    author_name: z.string(),
    created_at: timestamp,
    acknowledged_at: timestamp.nullable(),
    acknowledged_by_name: z.string().nullable(),
    is_mine: z.boolean(),
  })
  .strict();

export const patrolCheckpointSchema = z
  .object({
    id: z.uuid(),
    code: z.string().regex(codePattern),
    name: z.string(),
    location_note: z.string().nullable(),
    active: z.boolean(),
    version,
    created_at: timestamp,
  })
  .strict();

export const patrolGuardCheckpointSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    location_note: z.string().nullable(),
  })
  .strict();

export const patrolAdminWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    timezone: z.string().min(1),
    generated_at: timestamp,
    settings: z
      .object({
        photo_retention_days: z
          .number()
          .int()
          .min(PATROL_PHOTO_RETENTION_MIN_DAYS)
          .max(PATROL_PHOTO_RETENTION_MAX_DAYS),
      })
      .strict(),
    checkpoints: z.array(patrolCheckpointSchema),
    schedules: z.array(patrolScheduleSchema),
    scans: z.array(patrolScanSchema),
    incidents: z.array(patrolIncidentSchema),
    handover_notes: z.array(patrolHandoverSchema),
  })
  .strict();

export const patrolGuardWorkspaceSchema = z
  .object({
    timezone: z.string().min(1),
    generated_at: timestamp,
    checkpoints: z.array(patrolGuardCheckpointSchema),
    schedules: z.array(patrolScheduleSchema),
    scans: z.array(patrolScanSchema),
    incidents: z.array(patrolIncidentSchema),
    handover_notes: z.array(patrolHandoverSchema),
  })
  .strict();

export const patrolPrintSheetSchema = z
  .object({
    society_name: z.string(),
    checkpoints: z.array(
      z
        .object({
          id: z.uuid(),
          code: z.string().regex(codePattern),
          name: z.string(),
          location_note: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const patrolScanResultSchema = z
  .object({
    scan_id: z.uuid(),
    checkpoint_id: z.uuid(),
    checkpoint_name: z.string(),
    scanned_at: timestamp,
  })
  .strict();

export type PatrolCategory = z.infer<typeof patrolCategorySchema>;
export type PatrolSeverity = z.infer<typeof patrolSeveritySchema>;
export type PatrolSchedule = z.infer<typeof patrolScheduleSchema>;
export type PatrolScan = z.infer<typeof patrolScanSchema>;
export type PatrolIncident = z.infer<typeof patrolIncidentSchema>;
export type PatrolHandover = z.infer<typeof patrolHandoverSchema>;
export type PatrolCheckpoint = z.infer<typeof patrolCheckpointSchema>;
export type PatrolGuardCheckpoint = z.infer<typeof patrolGuardCheckpointSchema>;
export type PatrolAdminWorkspace = z.infer<typeof patrolAdminWorkspaceSchema>;
export type PatrolGuardWorkspace = z.infer<typeof patrolGuardWorkspaceSchema>;
export type PatrolPrintSheet = z.infer<typeof patrolPrintSheetSchema>;
export type PatrolScanResult = z.infer<typeof patrolScanResultSchema>;
