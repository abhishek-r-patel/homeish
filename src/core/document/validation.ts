// Validate Document Repository and factual governance inputs shared by forms and operations.
import { z } from 'zod';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '../files/constraints';

export const DEFAULT_DOCUMENT_SETTINGS = {
  expiry_reminders_enabled: false,
} as const;

export const documentSettingsSchema = z
  .object({ expiry_reminders_enabled: z.boolean().optional() })
  .strict();

export const documentSettingsInputSchema = z
  .object({ expiryRemindersEnabled: z.boolean() })
  .strict();

export const DOCUMENT_FOLDER_AUDIENCES = [
  'all_residents',
  'owners_only',
  'committee_admins',
] as const;
export const DOCUMENT_UNIT_AUDIENCES = [
  'all_occupants',
  'owners_only',
] as const;
export const DOCUMENT_SYSTEM_FOLDERS = [
  'bylaws',
  'minutes',
  'audit_reports',
  'circulars',
  'nocs',
] as const;

export const documentFolderAudienceSchema = z.enum(DOCUMENT_FOLDER_AUDIENCES);
export const documentUnitAudienceSchema = z.enum(DOCUMENT_UNIT_AUDIENCES);
export const documentContentTypeSchema = z.enum(FILE_CONTENT_TYPES);

const uuidPattern =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const DOCUMENT_PATH_PATTERN = new RegExp(
  `^(${uuidPattern})/documents/${uuidPattern}\\.(pdf|jpg|png)$`,
);
export const documentPathSchema = z
  .string()
  .max(500)
  .regex(DOCUMENT_PATH_PATTERN);

const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().min(1).max(2_147_483_647);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

export const documentFolderInputSchema = z
  .object({
    folderId: z.uuid().nullable(),
    name: z.string().trim().min(1, 'Enter a folder name.').max(80),
    audience: documentFolderAudienceSchema,
    expectedVersion: version.nullable(),
  })
  .strict()
  .refine(
    (input) => (input.folderId === null) === (input.expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the folder before saving.',
    },
  );

export const documentFolderArchiveInputSchema = z
  .object({
    folderId: z.uuid(),
    archived: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const documentUploadInputSchema = z
  .object({
    contentType: documentContentTypeSchema,
    sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  })
  .strict();

export const documentFileNameSchema = z.string().trim().min(1).max(200);

export const documentCreateInputSchema = z
  .object({
    folderId: z.uuid().nullable(),
    unitId: z.uuid().nullable(),
    unitAudience: documentUnitAudienceSchema.nullable(),
    title: z.string().trim().min(1, 'Enter a title.').max(120),
    description: optionalText(500),
    path: documentPathSchema,
    fileName: documentFileNameSchema,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.folderId === null) === (input.unitId === null)) {
      context.addIssue({
        code: 'custom',
        path: ['folderId'],
        message: 'Choose a folder or a unit.',
      });
    }
    if ((input.unitId === null) !== (input.unitAudience === null)) {
      context.addIssue({
        code: 'custom',
        path: ['unitAudience'],
        message: 'Choose who in the unit can see this document.',
      });
    }
  });

export const documentVersionInputSchema = z
  .object({
    documentId: z.uuid(),
    path: documentPathSchema,
    fileName: documentFileNameSchema,
    note: optionalText(500),
    expectedVersion: version,
  })
  .strict();

export const documentUpdateInputSchema = z
  .object({
    documentId: z.uuid(),
    title: z.string().trim().min(1, 'Enter a title.').max(120),
    description: optionalText(500),
    unitAudience: documentUnitAudienceSchema.nullable(),
    expectedVersion: version,
  })
  .strict();

export const documentArchiveInputSchema = z
  .object({
    documentId: z.uuid(),
    archived: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const documentVersionArchiveInputSchema = z
  .object({
    versionId: z.uuid(),
    archived: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const documentDownloadInputSchema = z
  .object({ versionId: z.uuid() })
  .strict();

export const documentListInputSchema = z
  .object({
    folderId: z.uuid().nullable(),
    unitId: z.uuid().nullable(),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict()
  .refine((input) => (input.folderId === null) !== (input.unitId === null), {
    path: ['folderId'],
    message: 'Choose a folder or a unit.',
  });

export const documentSearchSchema = z
  .object({
    folder: z.uuid().optional().catch(undefined),
    unit: z.uuid().optional().catch(undefined),
    document: z.uuid().optional().catch(undefined),
    archived: z
      .enum(['1'])
      .optional()
      .catch(undefined)
      .transform((value) => value === '1'),
    offset: z.coerce
      .number()
      .int()
      .min(0)
      .max(100_000)
      .optional()
      .catch(undefined)
      .transform((value) => value ?? 0),
    governanceKind: z
      .enum(['validity', 'register', 'amendment', 'house_rule'])
      .optional()
      .catch(undefined)
      .transform((value) => value ?? 'validity'),
    governanceSourceKind: z
      .enum(['document_version', 'tenancy_noc', 'meeting_resolution'])
      .optional()
      .catch(undefined)
      .transform((value) => value ?? 'document_version'),
    governanceSourceOffset: z.coerce
      .number()
      .int()
      .min(0)
      .max(100_000)
      .optional()
      .catch(undefined)
      .transform((value) => value ?? 0),
    governanceRecord: z.uuid().optional().catch(undefined),
    governanceArchived: z
      .enum(['1'])
      .optional()
      .catch(undefined)
      .transform((value) => value === '1'),
    governanceOffset: z.coerce
      .number()
      .int()
      .min(0)
      .max(100_000)
      .optional()
      .catch(undefined)
      .transform((value) => value ?? 0),
  })
  .strip();

export const documentFolderSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(80),
    audience: documentFolderAudienceSchema,
    system_key: z.enum(DOCUMENT_SYSTEM_FOLDERS).nullable(),
    sort_order: z.number().int(),
    version,
    archived_at: timestamp.nullable(),
    updated_at: timestamp,
    document_count: z.number().int().min(0),
  })
  .strict();

export const documentUnitSchema = z
  .object({
    id: z.uuid(),
    number: z.string().min(1).max(20),
    block_name: z.string().nullable(),
  })
  .strict();

export const documentWorkspaceUnitSchema = documentUnitSchema
  .extend({
    relationship: z.enum(['owner', 'tenant', 'family']).nullable(),
  })
  .strict();

export const documentVersionSchema = z
  .object({
    id: z.uuid(),
    version_number: z.number().int().min(1),
    file_name: z.string().min(1).max(200),
    content_type: documentContentTypeSchema,
    size_bytes: z.number().int().min(1).max(MAX_FILE_BYTES),
    note: z.string().nullable(),
    archived_at: timestamp.nullable(),
    created_at: timestamp,
  })
  .strict();

export const documentSchema = z
  .object({
    id: z.uuid(),
    folder_id: z.uuid().nullable(),
    unit_id: z.uuid().nullable(),
    unit_audience: documentUnitAudienceSchema.nullable(),
    title: z.string().min(1).max(120),
    description: z.string().nullable(),
    version,
    archived_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
    unit: documentUnitSchema.nullable(),
    current_version: documentVersionSchema.nullable(),
    version_count: z.number().int().min(0).nullable(),
  })
  .strict();

export const documentTenancyNocSchema = z
  .object({
    id: z.uuid(),
    move_id: z.uuid(),
    path: z.string().min(1).max(500),
    content_type: documentContentTypeSchema,
    size_bytes: z.number().int().min(1).max(MAX_FILE_BYTES),
    created_at: timestamp,
  })
  .strict();

export const documentWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    is_staff: z.boolean(),
    writable: z.boolean(),
    tenancy_enabled: z.boolean(),
    folders: z.array(documentFolderSchema),
    units: z.array(documentWorkspaceUnitSchema),
  })
  .strict();

export const documentListSchema = z
  .object({
    folder: documentFolderSchema.nullable(),
    unit: documentUnitSchema.nullable(),
    total: z.number().int().min(0),
    items: z.array(documentSchema),
    tenancy_nocs: z.array(documentTenancyNocSchema),
  })
  .strict();

export const documentDetailSchema = z
  .object({
    document: documentSchema,
    folder: documentFolderSchema.nullable(),
    versions: z.array(documentVersionSchema),
  })
  .strict();

export const documentDownloadSchema = z
  .object({
    path: documentPathSchema,
    file_name: z.string().min(1).max(200),
    content_type: documentContentTypeSchema,
  })
  .strict();

export type DocumentFolderAudience = z.infer<
  typeof documentFolderAudienceSchema
>;
export type DocumentUnitAudience = z.infer<typeof documentUnitAudienceSchema>;
export type DocumentFolder = z.infer<typeof documentFolderSchema>;
export type DocumentUnit = z.infer<typeof documentUnitSchema>;
export type DocumentWorkspaceUnit = z.infer<typeof documentWorkspaceUnitSchema>;
export type DocumentVersion = z.infer<typeof documentVersionSchema>;
export type DocumentItem = z.infer<typeof documentSchema>;
export type DocumentTenancyNoc = z.infer<typeof documentTenancyNocSchema>;
export type DocumentWorkspace = z.infer<typeof documentWorkspaceSchema>;
export type DocumentList = z.infer<typeof documentListSchema>;
export type DocumentDetail = z.infer<typeof documentDetailSchema>;

export const DOCUMENT_GOVERNANCE_KINDS = [
  'validity',
  'register',
  'amendment',
  'house_rule',
] as const;
export const DOCUMENT_GOVERNANCE_STATES = [
  'draft',
  'verified',
  'needs_review',
] as const;
export const DOCUMENT_GOVERNANCE_SOURCE_KINDS = [
  'document_version',
  'tenancy_noc',
  'meeting_resolution',
] as const;
export const DOCUMENT_GOVERNANCE_EXPIRY_KINDS = [
  'unknown',
  'dated',
  'perpetual',
] as const;
export const DOCUMENT_GOVERNANCE_MILESTONE_KINDS = [
  'meeting',
  'filing',
  'registrar_approval',
] as const;
export const DOCUMENT_GOVERNANCE_MAINTENANCE_STATES = [
  'not_started',
  'maintained',
  'needs_review',
  'not_applicable',
] as const;

export const documentGovernanceKindSchema = z.enum(DOCUMENT_GOVERNANCE_KINDS);
export const documentGovernanceStateSchema = z.enum(DOCUMENT_GOVERNANCE_STATES);
export const documentGovernanceSourceKindSchema = z.enum(
  DOCUMENT_GOVERNANCE_SOURCE_KINDS,
);
const dateOrNull = z.iso.date().nullable();
const governanceText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
const governanceSource = z
  .object({
    kind: documentGovernanceSourceKindSchema,
    id: z.uuid(),
  })
  .strict()
  .nullable();

export const documentGovernanceValidityDetailsSchema = z
  .object({
    issuingAuthority: governanceText(200),
    reference: governanceText(200),
    issueDate: dateOrNull,
    expiryKind: z.enum(DOCUMENT_GOVERNANCE_EXPIRY_KINDS),
    expiryDate: dateOrNull,
  })
  .strict()
  .superRefine((details, context) => {
    if ((details.expiryKind === 'dated') !== (details.expiryDate !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'A dated expiry needs an expiry date.',
      });
    }
  });

export const documentGovernanceRegisterDetailsSchema = z
  .object({
    name: governanceText(160),
    type: governanceText(120),
    basis: governanceText(500),
    maintenanceState: z.enum(DOCUMENT_GOVERNANCE_MAINTENANCE_STATES).nullable(),
    clauseOrPage: governanceText(200),
    format: governanceText(200),
    physicalLocation: governanceText(200),
    custodian: governanceText(200),
    reviewDate: dateOrNull,
  })
  .strict();

export const documentGovernanceAmendmentDetailsSchema = z
  .object({
    milestoneType: z.enum(DOCUMENT_GOVERNANCE_MILESTONE_KINDS),
    milestoneDate: dateOrNull,
    note: governanceText(500),
    historicalEvidence: z.boolean(),
  })
  .strict();

export const documentGovernanceHouseRuleDetailsSchema = z
  .object({
    text: governanceText(5000),
    approvalDate: dateOrNull,
    effectiveDate: dateOrNull,
  })
  .strict()
  .refine(
    (details) =>
      !details.approvalDate ||
      !details.effectiveDate ||
      details.effectiveDate >= details.approvalDate,
    {
      path: ['effectiveDate'],
      message: 'Effective date cannot be before the approval date.',
    },
  );

const governanceDetailsSchema = z.union([
  documentGovernanceValidityDetailsSchema,
  documentGovernanceRegisterDetailsSchema,
  documentGovernanceAmendmentDetailsSchema,
  documentGovernanceHouseRuleDetailsSchema,
]);

export const documentGovernanceSaveInputSchema = z
  .object({
    recordId: z.uuid().nullable(),
    kind: documentGovernanceKindSchema,
    title: z.string().trim().min(1).max(160),
    state: z.enum(['draft', 'verified']),
    source: governanceSource,
    approvingResolutionId: z.uuid().nullable(),
    details: governanceDetailsSchema,
    expectedVersion: version.nullable(),
    reason: governanceText(500),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.recordId === null) !== (input.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh the record before saving.',
      });
    }
    if (input.recordId !== null && input.reason === null) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason for this correction.',
      });
    }
    if (
      input.kind === 'house_rule' &&
      input.source?.kind !== 'document_version'
    ) {
      if (input.state === 'verified') {
        context.addIssue({
          code: 'custom',
          path: ['source'],
          message: 'House rules need a society-folder document.',
        });
      }
    } else if (
      input.kind !== 'house_rule' &&
      input.approvingResolutionId !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['approvingResolutionId'],
        message: 'Only house rules can have an approving decision.',
      });
    }
    if (input.state === 'verified' && input.source === null) {
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Verified records need authorized evidence.',
      });
    }
  });

export const documentGovernanceArchiveInputSchema = z
  .object({
    recordId: z.uuid(),
    archived: z.boolean(),
    expectedVersion: version,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const documentGovernanceListInputSchema = z
  .object({
    kind: documentGovernanceKindSchema.nullable(),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export const documentGovernanceSourceListInputSchema = z
  .object({
    kind: documentGovernanceKindSchema,
    sourceKind: documentGovernanceSourceKindSchema,
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export const documentGovernanceSourceSchema = z
  .object({
    state: z.enum(['unlinked', 'available', 'needs_review']),
    kind: documentGovernanceSourceKindSchema.optional(),
    id: z.uuid().nullable().optional(),
    label: z.string().min(1).max(200),
    versionNumber: z.string().nullable().optional(),
  })
  .strict();

export const documentGovernanceRecordSchema = z
  .object({
    id: z.uuid(),
    kind: documentGovernanceKindSchema,
    title: z.string().min(1).max(160),
    state: documentGovernanceStateSchema,
    source: documentGovernanceSourceSchema,
    version,
    archivedAt: timestamp.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
    validity: documentGovernanceValidityDetailsSchema
      .extend({
        dateState: z
          .enum(['unknown', 'perpetual', 'upcoming', 'due_today', 'past_date'])
          .optional(),
      })
      .optional(),
    register: documentGovernanceRegisterDetailsSchema.partial().optional(),
    amendment: documentGovernanceAmendmentDetailsSchema.partial().optional(),
    houseRule: z
      .object({
        text: z.string().nullable().optional(),
        approvalDate: dateOrNull.optional(),
        effectiveDate: dateOrNull.optional(),
        approvingResolutionId: z.uuid().nullable().optional(),
        approvingResolutionLabel: z.string().max(200).nullable().optional(),
        publicationState: z.enum([
          'draft',
          'published',
          'withdrawn',
          'superseded',
        ]),
        gateLocked: z.literal(true),
        decisionState: z.enum(['available', 'needs_review']),
      })
      .strict()
      .optional(),
  })
  .strict();

export const documentGovernanceListSchema = z
  .object({
    total: z.number().int().min(0),
    items: z.array(documentGovernanceRecordSchema),
    settings: z.object({ expiryRemindersEnabled: z.boolean() }).strict(),
    tenancyEnabled: z.boolean(),
    meetingEnabled: z.boolean(),
  })
  .strict();

export const documentGovernanceSourceListSchema = z
  .object({
    total: z.number().int().min(0),
    items: z.array(
      z
        .object({
          kind: documentGovernanceSourceKindSchema,
          id: z.uuid(),
          documentId: z.uuid().optional(),
          meetingId: z.uuid().optional(),
          moveId: z.uuid().optional(),
          title: z.string().min(1).max(200),
          fileName: z.string().max(200).optional(),
          versionNumber: z.number().int().min(1).optional(),
          scope: z.enum(['unit', 'society_folder']).optional(),
          issuedAt: timestamp.optional(),
          outcome: z
            .enum(['pending', 'passed', 'failed', 'deferred'])
            .optional(),
          historical: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

export const documentGovernanceHistoryItemSchema = z
  .object({
    id: z.uuid(),
    action: z.enum(['create', 'update', 'verify', 'archive', 'restore']),
    changedFields: z.array(z.string()),
    reason: z.string().max(500).nullable(),
    createdAt: timestamp,
    actorName: z.string().nullable(),
    previousValues: z.record(z.string(), z.unknown()),
  })
  .strict();

export const documentGovernanceHistoryInputSchema = z
  .object({
    recordId: z.uuid(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

export const documentHouseRulePublishInputSchema = z
  .object({
    recordId: z.uuid(),
    expectedVersion: version,
  })
  .strict();

export const documentGovernanceHistorySchema = z
  .object({
    total: z.number().int().min(0),
    items: z.array(documentGovernanceHistoryItemSchema),
  })
  .strict();

export const documentPublishedHouseRuleSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(160),
    text: z.string().min(1).max(5000),
    approvalDate: z.iso.date(),
    effectiveDate: z.iso.date(),
    sourceTitle: z.string().min(1).max(120),
  })
  .strict();

export const documentPublishedHouseRulesSchema = z
  .object({ items: z.array(documentPublishedHouseRuleSchema) })
  .strict();

export type DocumentGovernanceKind = z.infer<
  typeof documentGovernanceKindSchema
>;
export type DocumentGovernanceSourceKind = z.infer<
  typeof documentGovernanceSourceKindSchema
>;
export type DocumentGovernanceRecord = z.infer<
  typeof documentGovernanceRecordSchema
>;
export type DocumentGovernanceSource = z.infer<
  typeof documentGovernanceSourceListSchema
>['items'][number];
export type DocumentPublishedHouseRule = z.infer<
  typeof documentPublishedHouseRuleSchema
>;
