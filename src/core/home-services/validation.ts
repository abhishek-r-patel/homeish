// Validate Home-Services Directory settings, form input and the database read models.
import { z } from 'zod';

export const DEFAULT_HOME_SERVICES_SETTINGS = {} as const;

export const homeServicesSettingsSchema = z.object({}).strict();

export const HOME_SERVICE_TYPES = [
  'plumber',
  'electrician',
  'carpenter',
  'painter',
  'pest_control',
  'appliance_repair',
  'cleaning',
  'other',
] as const;
export const homeServiceTypeSchema = z.enum(HOME_SERVICE_TYPES);

export const HOME_SERVICES_NAME_MAX = 120;
export const HOME_SERVICES_AREA_MAX = 120;
export const HOME_SERVICES_NOTES_MAX = 500;
export const HOME_SERVICES_COMMENT_MAX = 500;
export const HOME_SERVICES_REASON_MAX = 300;
/** Mirrors home_services_providers_phone_check. */
export const HOME_SERVICES_PHONE_PATTERN = /^\+?[0-9][0-9 -]{4,18}[0-9]$/;

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

const providerFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Enter the provider name.')
    .max(
      HOME_SERVICES_NAME_MAX,
      `Keep the name within ${HOME_SERVICES_NAME_MAX} characters.`,
    ),
  serviceType: homeServiceTypeSchema,
  phone: z
    .string()
    .trim()
    .regex(
      HOME_SERVICES_PHONE_PATTERN,
      'Enter a phone number of 6 to 20 digits, for example 98765 43210.',
    ),
  area: optionalText(
    HOME_SERVICES_AREA_MAX,
    `Keep the area within ${HOME_SERVICES_AREA_MAX} characters.`,
  ),
  notes: optionalText(
    HOME_SERVICES_NOTES_MAX,
    `Keep the notes within ${HOME_SERVICES_NOTES_MAX} characters.`,
  ),
};

export const homeServicesProviderInputSchema = z
  .object({
    providerId: z.uuid().nullable(),
    ...providerFields,
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    ({ providerId, expectedVersion }) =>
      (providerId === null) === (expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the provider before editing it.',
    },
  );

export const homeServicesSuggestionInputSchema = z
  .object({ ...providerFields, clientRequestId: z.uuid() })
  .strict();

export const homeServicesReviewInputSchema = z
  .object({
    providerId: z.uuid(),
    approve: z.boolean(),
    reason: optionalText(
      HOME_SERVICES_REASON_MAX,
      `Keep the reason within ${HOME_SERVICES_REASON_MAX} characters.`,
    ),
    expectedVersion: version,
  })
  .strict()
  .refine(({ approve, reason }) => !approve || reason === null, {
    path: ['reason'],
    message: 'A reason is only recorded when a suggestion is not approved.',
  });

export const homeServicesArchiveInputSchema = z
  .object({ providerId: z.uuid(), expectedVersion: version })
  .strict();

export const homeServicesRatingInputSchema = z
  .object({
    providerId: z.uuid(),
    stars: z
      .number({ error: 'Choose 1 to 5 stars.' })
      .int('Choose 1 to 5 stars.')
      .min(1, 'Choose 1 to 5 stars.')
      .max(5, 'Choose 1 to 5 stars.'),
    comment: optionalText(
      HOME_SERVICES_COMMENT_MAX,
      `Keep the comment within ${HOME_SERVICES_COMMENT_MAX} characters.`,
    ),
  })
  .strict();

export const homeServicesCommentVisibilityInputSchema = z
  .object({ ratingId: z.uuid(), hidden: z.boolean() })
  .strict();

const stars = z.number().int().min(1).max(5);
const average = z.number().min(1).max(5).nullable();

export const homeServicesProviderSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    service_type: homeServiceTypeSchema,
    phone: z.string(),
    area: z.string().nullable(),
    notes: z.string().nullable(),
    average_stars: average,
    rating_count: z.number().int().min(0),
    my_stars: stars.nullable(),
  })
  .strict();

export const homeServicesManagedProviderSchema = homeServicesProviderSchema
  .extend({
    status: z.enum(['pending', 'approved', 'rejected']),
    origin: z.enum(['admin', 'suggestion']),
    suggested_by_name: z.string().nullable(),
    review_reason: z.string().nullable(),
    reviewed_at: timestamp.nullable(),
    archived_at: timestamp.nullable(),
    created_at: timestamp,
    version,
  })
  .strict();

export const homeServicesDirectorySchema = z
  .object({
    can_rate: z.boolean(),
    providers: z.array(homeServicesProviderSchema),
    truncated: z.boolean(),
  })
  .strict();

export const homeServicesCommentSchema = z
  .object({
    id: z.uuid(),
    stars,
    comment: z.string().nullable(),
    comment_hidden: z.boolean(),
    rater_name: z.string().nullable(),
    is_mine: z.boolean(),
    updated_at: timestamp,
  })
  .strict();

export const homeServicesProviderDetailSchema = z
  .object({
    provider: homeServicesProviderSchema,
    is_listed: z.boolean(),
    can_rate: z.boolean(),
    can_moderate: z.boolean(),
    my_rating: z
      .object({
        id: z.uuid(),
        stars,
        comment: z.string().nullable(),
        comment_hidden: z.boolean(),
        updated_at: timestamp,
      })
      .strict()
      .nullable(),
    comments: z.array(homeServicesCommentSchema),
  })
  .strict();

export const homeServicesAdminWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    can_suggest: z.boolean(),
    providers: z.array(homeServicesManagedProviderSchema),
    truncated: z.boolean(),
    comments: z.array(
      z
        .object({
          id: z.uuid(),
          provider_id: z.uuid(),
          provider_name: z.string(),
          stars,
          comment: z.string().nullable(),
          comment_hidden: z.boolean(),
          rater_name: z.string().nullable(),
          updated_at: timestamp,
        })
        .strict(),
    ),
  })
  .strict();

export type HomeServiceType = z.infer<typeof homeServiceTypeSchema>;
export type HomeServicesProvider = z.infer<typeof homeServicesProviderSchema>;
export type HomeServicesManagedProvider = z.infer<
  typeof homeServicesManagedProviderSchema
>;
export type HomeServicesDirectory = z.infer<typeof homeServicesDirectorySchema>;
export type HomeServicesProviderDetail = z.infer<
  typeof homeServicesProviderDetailSchema
>;
export type HomeServicesAdminWorkspace = z.infer<
  typeof homeServicesAdminWorkspaceSchema
>;
