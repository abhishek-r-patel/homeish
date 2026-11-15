// Validate Document Repository input; the module has no society-level settings.
import { z } from 'zod';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '../files/constraints';

export const DEFAULT_DOCUMENT_SETTINGS = {} as const;

export const documentSettingsSchema = z.object({}).strict();

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
