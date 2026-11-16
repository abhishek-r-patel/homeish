// Validate Utility Metering settings, form input and the database read models.
import { z } from 'zod';
import { MAX_FILE_BYTES } from '../files/constraints';

export const DEFAULT_METERING_SETTINGS = {} as const;

export const meteringSettingsSchema = z.object({}).strict();

export const METERING_TYPES = ['water', 'electricity', 'dg', 'gas'] as const;
export const METERING_SCOPES = ['unit', 'common'] as const;
export const METERING_PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
] as const;
export const METERING_MAX_RATE_PAISE = 10_000_000;
export const METERING_MAX_READING = '99999999999.999';
export const METERING_REASON_MIN = 3;
export const METERING_REASON_MAX = 300;

export const meteringTypeSchema = z.enum(METERING_TYPES);
export const meteringScopeSchema = z.enum(METERING_SCOPES);

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
/** A non-negative decimal with up to 11 whole digits and 3 decimals, kept as text for exactness. */
export const METERING_DECIMAL_PATTERN = /^\d{1,11}(\.\d{1,3})?$/;
const decimalText = z.string().regex(METERING_DECIMAL_PATTERN);

/** Accept "1,234.5" style input and return the canonical decimal text, or fail. */
export function normaliseMeterValue(value: string) {
  const clean = value.trim().replace(/,/g, '');
  if (!METERING_DECIMAL_PATTERN.test(clean)) return null;
  const [whole = '0', fraction] = clean.split('.');
  const wholeDigits = whole.replace(/^0+(?=\d)/, '');
  const fractionDigits = (fraction ?? '').replace(/0+$/, '');
  return fractionDigits ? `${wholeDigits}.${fractionDigits}` : wholeDigits;
}

const meterValue = z
  .string()
  .max(40)
  .transform((value, context) => {
    const clean = normaliseMeterValue(value);
    if (clean === null) {
      context.addIssue({
        code: 'custom',
        message:
          'Enter a reading of 0 or more with up to 3 decimals, for example 1234.5.',
      });
      return z.NEVER;
    }
    return clean;
  });

function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value ? value : null));
}

const reasonText = (label: string) =>
  z
    .string()
    .trim()
    .min(
      METERING_REASON_MIN,
      `${label} needs at least ${METERING_REASON_MIN} characters.`,
    )
    .max(
      METERING_REASON_MAX,
      `Keep the reason within ${METERING_REASON_MAX} characters.`,
    );
const optionalReason = z
  .string()
  .trim()
  .max(
    METERING_REASON_MAX,
    `Keep the reason within ${METERING_REASON_MAX} characters.`,
  )
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || value.length >= METERING_REASON_MIN, {
    message: `Give a reason of at least ${METERING_REASON_MIN} characters.`,
  });

const version = z.number().int().min(1).max(2_147_483_647);
const timestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

export const meteringPhotoPathSchema = z
  .string()
  .max(500)
  .regex(new RegExp(`^${UUID}/readings/${UUID}/${UUID}\\.(jpg|png)$`));

export const meteringPhotoUploadInputSchema = z
  .object({
    contentType: z.enum(METERING_PHOTO_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  })
  .strict();

export const meteringMeterInputSchema = z
  .object({
    meterId: z.uuid().nullable(),
    meterType: meteringTypeSchema,
    scope: meteringScopeSchema,
    unitId: z.uuid().nullable(),
    label: z
      .string()
      .trim()
      .min(1, 'Enter a meter label.')
      .max(60, 'Keep the label within 60 characters.'),
    serialNumber: optionalText(
      60,
      'Keep the serial number within 60 characters.',
    ),
    initialReading: meterValue,
    active: z.boolean(),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.scope === 'unit') !== (input.unitId !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['unitId'],
        message:
          input.scope === 'unit'
            ? 'Choose the unit this meter belongs to.'
            : 'A common-area meter does not belong to a unit.',
      });
    }
    if ((input.meterId === null) !== (input.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh the meter before editing it.',
      });
    }
  });

export const meteringRateInputSchema = z
  .object({
    meterType: meteringTypeSchema,
    ratePaise: z
      .number()
      .int('Enter the rate in whole paise.')
      .min(0, 'The rate cannot be negative.')
      .max(
        METERING_MAX_RATE_PAISE,
        'The rate can be at most Rs 1,00,000 per unit.',
      ),
    clientRequestId: z.uuid(),
  })
  .strict();

export const meteringReadingInputSchema = z
  .object({
    meterId: z.uuid(),
    readingValue: meterValue,
    readingDate: isoDate,
    lowerReason: optionalReason,
    photoPath: meteringPhotoPathSchema.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict();

export const meteringReviewInputSchema = z.discriminatedUnion('decision', [
  z
    .object({
      readingId: z.uuid(),
      decision: z.literal('approve'),
      reason: optionalReason,
    })
    .strict(),
  z
    .object({
      readingId: z.uuid(),
      decision: z.literal('reject'),
      reason: reasonText('A rejection reason'),
    })
    .strict(),
]);

export const meteringBillingRunInputSchema = z
  .object({ billDate: isoDate })
  .strict();

export const meteringGuardQuerySchema = optionalText(
  40,
  'Search with up to 40 characters.',
);

const unitSchema = z.object({ id: z.uuid(), number: z.string() }).strict();
const readingStatusSchema = z.enum(['pending', 'approved', 'rejected']);
const readingSourceSchema = z.enum(['admin', 'guard', 'resident']);
const chargeStatusSchema = z.enum(['pending', 'billed', 'no_charge']);
const paise = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const meteringRateSchema = z
  .object({
    meter_type: meteringTypeSchema,
    rate_paise: z.number().int().min(0).max(METERING_MAX_RATE_PAISE),
    set_at: timestamp,
  })
  .strict();

export const meteringMeterSchema = z
  .object({
    id: z.uuid(),
    meter_type: meteringTypeSchema,
    scope: meteringScopeSchema,
    unit_id: z.uuid().nullable(),
    unit_number: z.string().nullable(),
    label: z.string(),
    serial_number: z.string().nullable(),
    active: z.boolean(),
    last_reading_value: decimalText.nullable(),
    last_reading_date: isoDate.nullable(),
    base_value: decimalText,
    has_pending: z.boolean(),
  })
  .strict();

export const meteringAdminMeterSchema = meteringMeterSchema
  .extend({
    initial_reading: decimalText,
    version,
    has_readings: z.boolean(),
  })
  .strict();

export const meteringResidentReadingSchema = z
  .object({
    id: z.uuid(),
    meter_id: z.uuid(),
    meter_label: z.string(),
    meter_type: meteringTypeSchema,
    reading_value: decimalText,
    reading_date: isoDate,
    status: readingStatusSchema,
    source: readingSourceSchema,
    consumption: decimalText.nullable(),
    is_reset: z.boolean(),
    lower_reason: z.string().nullable(),
    rejection_reason: z.string().nullable(),
    photo_path: meteringPhotoPathSchema.nullable(),
    is_mine: z.boolean(),
    created_at: timestamp,
    charge_status: chargeStatusSchema.nullable(),
    charge_amount_paise: paise.nullable(),
    bill_id: z.uuid().nullable(),
  })
  .strict();

export const meteringResidentWorkspaceSchema = z
  .object({
    billing_enabled: z.boolean(),
    today: isoDate,
    units: z.array(unitSchema),
    rates: z.array(meteringRateSchema),
    meters: z.array(meteringMeterSchema),
    readings: z.array(meteringResidentReadingSchema),
  })
  .strict();

export const meteringQueueItemSchema = z
  .object({
    id: z.uuid(),
    meter_id: z.uuid(),
    meter_label: z.string(),
    meter_type: meteringTypeSchema,
    unit_number: z.string().nullable(),
    reading_value: decimalText,
    reading_date: isoDate,
    base_value: decimalText,
    lower_reason: z.string().nullable(),
    photo_path: meteringPhotoPathSchema.nullable(),
    submitted_by: z.string().nullable(),
    created_at: timestamp,
  })
  .strict();

export const meteringRecentReadingSchema = z
  .object({
    id: z.uuid(),
    meter_id: z.uuid(),
    meter_label: z.string(),
    meter_type: meteringTypeSchema,
    unit_number: z.string().nullable(),
    reading_value: decimalText,
    reading_date: isoDate,
    status: z.enum(['approved', 'rejected']),
    source: readingSourceSchema,
    consumption: decimalText.nullable(),
    is_reset: z.boolean(),
    lower_reason: z.string().nullable(),
    rejection_reason: z.string().nullable(),
    photo_path: meteringPhotoPathSchema.nullable(),
    created_at: timestamp,
    charge_status: chargeStatusSchema.nullable(),
    charge_amount_paise: paise.nullable(),
  })
  .strict();

export const meteringReportSchema = z
  .object({
    months: z.array(isoDate),
    meters: z.array(
      z
        .object({
          meter_id: z.uuid(),
          label: z.string(),
          meter_type: meteringTypeSchema,
          scope: meteringScopeSchema,
          unit_number: z.string().nullable(),
          unit_occupied: z.boolean(),
          periods: z.array(
            z
              .object({
                month: isoDate,
                consumption: decimalText,
                readings: z.number().int().min(0),
                resets: z.number().int().min(0),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export const meteringAdminWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    billing_enabled: z.boolean(),
    today: isoDate,
    units: z.array(unitSchema),
    meters: z.array(meteringAdminMeterSchema),
    rates: z.array(meteringRateSchema),
    rate_history: z.array(meteringRateSchema.extend({ id: z.uuid() }).strict()),
    queue: z.array(meteringQueueItemSchema),
    recent: z.array(meteringRecentReadingSchema),
    charges: z
      .object({
        pending_count: z.number().int().min(0),
        pending_without_rate: z.number().int().min(0),
        billed_count: z.number().int().min(0),
        no_charge_count: z.number().int().min(0),
        billed_paise: paise,
        last_billed_at: timestamp.nullable(),
      })
      .strict(),
    report: meteringReportSchema,
  })
  .strict();

export const meteringGuardBoardSchema = z
  .object({
    query: z.string().nullable(),
    today: isoDate,
    meters: z.array(meteringMeterSchema),
    recent: z.array(
      z
        .object({
          id: z.uuid(),
          meter_label: z.string(),
          meter_type: meteringTypeSchema,
          unit_number: z.string().nullable(),
          reading_value: decimalText,
          reading_date: isoDate,
          consumption: decimalText.nullable(),
          is_reset: z.boolean(),
          created_at: timestamp,
        })
        .strict(),
    ),
  })
  .strict();

export const meteringBillingResultSchema = z
  .object({
    billing_enabled: z.boolean(),
    bills_created: z.number().int().min(0),
    charges_billed: z.number().int().min(0),
    charges_no_charge: z.number().int().min(0),
    charges_without_rate: z.number().int().min(0),
    billed_paise: paise,
    has_more: z.boolean(),
  })
  .strict();

export type MeteringType = z.infer<typeof meteringTypeSchema>;
export type MeteringScope = z.infer<typeof meteringScopeSchema>;
export type MeteringMeter = z.infer<typeof meteringMeterSchema>;
export type MeteringAdminMeter = z.infer<typeof meteringAdminMeterSchema>;
export type MeteringRate = z.infer<typeof meteringRateSchema>;
export type MeteringResidentReading = z.infer<
  typeof meteringResidentReadingSchema
>;
export type MeteringQueueItem = z.infer<typeof meteringQueueItemSchema>;
export type MeteringRecentReading = z.infer<typeof meteringRecentReadingSchema>;
export type MeteringReport = z.infer<typeof meteringReportSchema>;
export type MeteringResidentWorkspace = z.infer<
  typeof meteringResidentWorkspaceSchema
>;
export type MeteringAdminWorkspace = z.infer<
  typeof meteringAdminWorkspaceSchema
>;
export type MeteringGuardBoard = z.infer<typeof meteringGuardBoardSchema>;
export type MeteringBillingResult = z.infer<typeof meteringBillingResultSchema>;
