// Authorize and run the shared P56 CSV preview and atomic save operations.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId, ValidationError } from '../errors';
import type { ModuleKey } from '../modules';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  BULK_IMPORT_KINDS,
  parseBulkImport,
  type BulkImportContext,
  type BulkImportKind,
} from './bulk-import';

const importInputSchema = z
  .object({
    kind: z.enum(BULK_IMPORT_KINDS),
    csv: z.string(),
    societyId: z.uuid().nullable().optional(),
  })
  .strict();

const importContextSchema = z
  .object({
    blocks: z.array(
      z.object({ id: z.uuid(), name: z.string().min(1).max(80) }).strict(),
    ),
    units: z.array(
      z
        .object({
          id: z.uuid(),
          block_id: z.uuid().nullable(),
          number: z.string().min(1).max(40),
        })
        .strict(),
    ),
    residents: z.array(
      z
        .object({
          membership_id: z.uuid(),
          email: z.email(),
          unit_id: z.uuid(),
        })
        .strict(),
    ),
    assetCategories: z.array(
      z.object({ id: z.uuid(), name: z.string().min(1).max(60) }).strict(),
    ),
    existingResidentEmails: z.array(z.email()),
    existingVehicleRegistrations: z.array(z.string().regex(/^[A-Z0-9]{4,16}$/)),
    existingDomesticStaffPhones: z.array(z.string().regex(/^\+?[0-9]{10,15}$/)),
    openingDuesImported: z.boolean(),
  })
  .strict();

const ACCESS: Readonly<
  Record<BulkImportKind, { moduleKey: ModuleKey; permission: string }>
> = {
  units: { moduleKey: 'core', permission: 'structure:manage' },
  residents: { moduleKey: 'core', permission: 'membership:manage' },
  opening_dues: {
    moduleKey: 'billing',
    permission: 'billing:charges:manage',
  },
  vehicles: { moduleKey: 'directory', permission: 'directory:manage' },
  staff: { moduleKey: 'staff', permission: 'staff:manage' },
  assets: { moduleKey: 'asset', permission: 'asset:manage' },
};

async function getImportContext(kind: BulkImportKind, societyId?: string) {
  const context = await buildRequestContext(createRequestId());
  const targetSocietyId = societyId ?? context.societyId;
  if (!targetSocietyId) throw new AppError('FORBIDDEN');
  if (societyId !== undefined) {
    if (!context.isDeveloper) throw new AppError('FORBIDDEN');
  } else {
    authorizeRequest(context, {
      moduleKey: ACCESS[kind].moduleKey,
      permission: ACCESS[kind].permission,
      write: false,
    });
  }
  const data = await callModuleRpc(
    context,
    'bulk_import_context_get',
    { p_society_id: targetSocietyId },
    importContextSchema,
    'The import context could not be loaded.',
  );
  return { context, societyId: targetSocietyId, data };
}

export async function previewBulkImport(input: unknown) {
  const parsed = parseModuleInput(importInputSchema, input);
  const { data } = await getImportContext(
    parsed.kind,
    parsed.societyId ?? undefined,
  );
  const preview = parseBulkImport(
    parsed.kind,
    parsed.csv,
    data satisfies BulkImportContext,
  );
  if (parsed.kind === 'opening_dues' && data.openingDuesImported) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'file',
          message: 'Opening dues can be imported only once for this society.',
        },
      ],
    };
  }
  return preview;
}

export async function saveBulkImport(input: unknown) {
  const parsed = parseModuleInput(importInputSchema, input);
  const { context, societyId, data } = await getImportContext(
    parsed.kind,
    parsed.societyId ?? undefined,
  );
  if (!parsed.societyId) {
    authorizeRequest(context, {
      moduleKey: ACCESS[parsed.kind].moduleKey,
      permission: ACCESS[parsed.kind].permission,
      write: true,
    });
  }
  await enforceRateLimit(
    'otherWritesUserMinute',
    context.userId,
    context.requestId,
  );
  if (parsed.kind === 'opening_dues' && data.openingDuesImported) {
    throw new ValidationError({
      file: 'Opening dues have already been imported for this society.',
    });
  }
  const preview = parseBulkImport(
    parsed.kind,
    parsed.csv,
    data satisfies BulkImportContext,
  );
  if (preview.issues.length || !preview.rows.length) {
    throw new ValidationError({
      file: 'Fix every row error before saving the import.',
    });
  }
  return callModuleRpc(
    context,
    'bulk_import_save',
    {
      p_society_id: societyId,
      p_kind: parsed.kind,
      p_rows: preview.rows,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The CSV import could not be saved.',
  );
}
