// Validate the optional tenancy workflow without coupling platform sessions to it.
import { z } from 'zod';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '../../files/constraints';

export const DEFAULT_TENANCY_SETTINGS = {
  police_verification_required: false,
} as const;

export const tenancySettingsSchema = z
  .object({ police_verification_required: z.boolean().optional() })
  .strict();

export const tenancySettingsInputSchema = z
  .object({ policeVerificationRequired: z.boolean() })
  .strict();

export const TENANCY_STATUSES = [
  'awaiting_consent',
  'pending_review',
  'approved',
  'rejected',
  'cancelled',
  'completed',
] as const;

export const tenancyStatusSchema = z.enum(TENANCY_STATUSES);
export const tenancyKindSchema = z.enum(['move_in', 'move_out']);
export const tenancyProofKindSchema = z.enum([
  'rental_agreement',
  'police_verification',
]);
export const tenancyDocumentKindSchema = z.enum([
  'rental_agreement',
  'police_verification',
  'noc',
]);

const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().min(1).max(2_147_483_647);

export const tenancyMoveInputSchema = z
  .object({
    unitId: z.uuid(),
    tenantMembershipId: z.uuid(),
    kind: tenancyKindSchema,
    startsAt: timestamp,
    endsAt: timestamp,
    agreementExpiresOn: z.iso.date().nullable(),
    amenityBookingId: z.uuid().nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Choose an end time after the start time.',
      });
    }
    if ((input.kind === 'move_in') !== (input.agreementExpiresOn !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['agreementExpiresOn'],
        message:
          input.kind === 'move_in'
            ? 'Enter the rental agreement expiry date.'
            : 'Agreement expiry is only needed for move-in.',
      });
    }
  });

export const tenancyVersionInputSchema = z
  .object({ moveId: z.uuid(), expectedVersion: version })
  .strict();

export const tenancyDecisionInputSchema = z
  .object({
    moveId: z.uuid(),
    expectedVersion: version,
    decision: z.enum(['approved', 'rejected', 'cancelled']),
    reason: z.string().trim().min(1).max(500).nullable(),
  })
  .strict()
  .refine(
    ({ decision, reason }) => decision === 'approved' || reason !== null,
    { path: ['reason'], message: 'Enter a reason for this decision.' },
  );

export const tenancyPageInputSchema = z
  .object({
    status: tenancyStatusSchema.nullable().default(null),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export const tenancyListSearchSchema = z
  .object({
    status: tenancyPageInputSchema.shape.status,
    limit: z.coerce
      .number()
      .pipe(
        z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
      )
      .default(25),
    offset: z.coerce
      .number()
      .pipe(tenancyPageInputSchema.shape.offset.unwrap())
      .default(0),
  })
  .strict();

export const tenancyMoveSummarySchema = z
  .object({
    id: z.uuid(),
    unit_id: z.uuid(),
    unit_number: z.string(),
    kind: tenancyKindSchema,
    status: tenancyStatusSchema,
    starts_at: timestamp,
    ends_at: timestamp,
    version,
    can_view_details: z.boolean(),
  })
  .strict();

export const tenancyPageSchema = z
  .object({
    items: z.array(tenancyMoveSummarySchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    ({ items, total, limit, offset }) =>
      items.length <= Math.min(limit, Math.max(0, total - offset)),
    { message: 'Move page items exceed the declared bounds.' },
  );

export const tenancyWorkspaceSchema = z
  .object({
    today: z.iso.date(),
    timezone: z.string().min(1),
    unit_label: z.string().min(1),
    can_manage: z.boolean(),
    can_create: z.boolean(),
    can_write: z.boolean(),
    police_verification_required: z.boolean(),
    amenity_enabled: z.boolean(),
    units: z.array(z.object({ id: z.uuid(), number: z.string() }).strict()),
    tenants: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          status: z.enum(['active', 'invited', 'pending_approval']),
        })
        .strict(),
    ),
    occupancies: z.array(
      z
        .object({
          unit_id: z.uuid(),
          membership_id: z.uuid(),
          is_tenant: z.boolean(),
          status: z.enum(['pending', 'active']),
        })
        .strict(),
    ),
    bookings: z.array(
      z
        .object({
          id: z.uuid(),
          unit_id: z.uuid(),
          name: z.string(),
          starts_at: timestamp,
          ends_at: timestamp,
        })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (workspace) =>
      workspace.can_create ||
      [
        workspace.units,
        workspace.tenants,
        workspace.occupancies,
        workspace.bookings,
      ].every((items) => items.length === 0),
    {
      message:
        'Read-only schedule access must not include private move targets.',
    },
  );

export const tenancyDocumentSchema = z
  .object({
    id: z.uuid(),
    kind: tenancyDocumentKindSchema,
    path: z.string().min(1).max(500),
    content_type: z.enum(FILE_CONTENT_TYPES),
    size_bytes: z.number().int().min(1).max(MAX_FILE_BYTES),
    created_at: timestamp,
  })
  .strict();

export const tenancyEventSchema = z
  .object({
    id: z.uuid(),
    action: z.enum([
      'created',
      'document_attached',
      'consented',
      'approved',
      'rejected',
      'cancelled',
      'completed',
      'noc_issued',
    ]),
    status: tenancyStatusSchema,
    reason: z.string().nullable(),
    actor_name: z.string(),
    created_at: timestamp,
  })
  .strict();

const checkedDuesFields = {
  balance_paise: z.string().regex(/^-?\d+$/),
  checked_at: timestamp,
};
const clearedDuesSchema = z
  .object({
    ...checkedDuesFields,
    status: z.literal('cleared'),
    balance_paise: checkedDuesFields.balance_paise.pipe(
      z.string().refine((value) => BigInt(value) <= BigInt(0), {
        message: 'Cleared dues cannot contain a positive outstanding balance.',
      }),
    ),
  })
  .strict();
const uncheckedDuesSchema = z
  .object({
    status: z.literal('not_checked'),
    balance_paise: z.null(),
    checked_at: z.null(),
  })
  .strict();
export const tenancyDuesSchema = z.discriminatedUnion('status', [
  clearedDuesSchema,
  z
    .object({
      ...checkedDuesFields,
      status: z.literal('pending'),
      balance_paise: checkedDuesFields.balance_paise.pipe(
        z.string().refine((value) => BigInt(value) > BigInt(0), {
          message: 'Pending dues require a positive outstanding balance.',
        }),
      ),
    })
    .strict(),
  uncheckedDuesSchema,
]);

export const tenancyDocumentPathSchema = z
  .string()
  .max(500)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/moves\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(rental_agreement|police_verification|noc)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$/,
  );

export const tenancyNocPathSchema =
  tenancyDocumentPathSchema.regex(/\/noc\/[^/]+\.pdf$/);

export const tenancyNocSnapshotSchema = z
  .object({
    society_name: z.string().min(1).max(200),
    tenant_name: z.string().min(1).max(120),
    unit_number: z.string().min(1).max(50),
    move_date: z.iso.date(),
    issuer_name: z.string().min(1).max(120),
    issued_at: timestamp,
    timezone: z.string().min(1).max(100),
    dues: z.discriminatedUnion('status', [
      clearedDuesSchema,
      uncheckedDuesSchema,
    ]),
  })
  .strict();

export const tenancyNocPreparationSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('prepared'),
      path: tenancyNocPathSchema,
      expected_version: version,
      snapshot: tenancyNocSnapshotSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('issued'),
      path: tenancyNocPathSchema,
      document_id: z.uuid(),
    })
    .strict(),
]);

export const tenancyMoveDetailSchema = z
  .object({
    move: tenancyMoveSummarySchema,
    tenant_membership_id: z.uuid(),
    tenant_name: z.string(),
    agreement_expires_on: z.iso.date().nullable(),
    amenity_booking_id: z.uuid().nullable(),
    completed_at: timestamp.nullable(),
    owner_consent_valid: z.boolean(),
    police_verification_required: z.boolean(),
    can_manage: z.boolean(),
    can_consent: z.boolean(),
    can_cancel: z.boolean(),
    documents: z.array(tenancyDocumentSchema),
    events: z.array(tenancyEventSchema),
    dues: tenancyDuesSchema.nullable(),
  })
  .strict();

export const tenancyDocumentInputSchema = z
  .object({
    moveId: z.uuid(),
    expectedVersion: version,
    kind: tenancyProofKindSchema,
    path: z.string().min(1).max(500),
  })
  .strict();

export type TenancyStatus = z.infer<typeof tenancyStatusSchema>;
export type TenancyMoveSummary = z.infer<typeof tenancyMoveSummarySchema>;
export type TenancyMoveDetail = z.infer<typeof tenancyMoveDetailSchema>;
export type TenancyPage = z.infer<typeof tenancyPageSchema>;
export type TenancyWorkspace = z.infer<typeof tenancyWorkspaceSchema>;
export type TenancyMoveInput = z.infer<typeof tenancyMoveInputSchema>;
export type TenancyProofKind = z.infer<typeof tenancyProofKindSchema>;
export type TenancyNocSnapshot = z.infer<typeof tenancyNocSnapshotSchema>;
export type TenancyNocPreparation = z.infer<typeof tenancyNocPreparationSchema>;
