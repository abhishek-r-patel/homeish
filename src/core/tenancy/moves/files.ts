// Authorise private tenancy file URLs and store only the prepared NOC bytes.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../../db/validated-rpc';
import { AppError, ConflictError } from '../../errors';
import type { FileContentType } from '../../files/attachments';
import { authorizeRequest } from '../../permissions/authorize';
import type { RequestContext } from '../request-context';
import { tenancyNocPdf } from './documents';
import {
  tenancyDocumentPathSchema,
  tenancyMoveDetailSchema,
  type TenancyNocPreparation,
  type TenancyProofKind,
} from './validation';

export async function prepareTenancyProofUpload(
  context: RequestContext,
  input: {
    moveId: string;
    kind: TenancyProofKind;
    contentType: FileContentType;
    sizeBytes: number;
  },
) {
  authorizeRequest(context, {
    moduleKey: 'tenancy',
    permission: 'tenancy:files',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return callModuleRpc(
    context,
    'tenancy_proof_upload_path',
    {
      p_society_id: context.societyId,
      p_move_id: input.moveId,
      p_kind: input.kind,
      p_content_type: input.contentType,
      p_size_bytes: input.sizeBytes,
    },
    tenancyDocumentPathSchema,
    'The proof upload is unavailable. Refresh the move and use a PDF, JPG or PNG up to 5 MiB.',
  );
}

export async function authoriseTenancyDocumentView(
  context: RequestContext,
  inputPath: string,
) {
  authorizeRequest(context, {
    moduleKey: 'tenancy',
    permission: 'tenancy:files',
  });
  const path = parseModuleInput(tenancyDocumentPathSchema, inputPath);
  const [societyId, , moveId] = path.split('/');
  if (!moveId || !societyId || societyId !== context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  const detail = await callModuleRpc(
    context,
    'tenancy_move_get',
    { p_society_id: societyId, p_move_id: moveId },
    tenancyMoveDetailSchema,
    'Could not verify access to this tenant document. Refresh and retry.',
  );
  if (!detail.documents.some((document) => document.path === path)) {
    throw new AppError('NOT_FOUND');
  }
}

export async function storePreparedTenancyNoc(
  context: RequestContext,
  preparation: Extract<TenancyNocPreparation, { status: 'prepared' }>,
) {
  const bytes = await tenancyNocPdf(preparation.snapshot);
  const bucket = context.db.storage.from('tenancy-files');
  const { error } = await bucket.upload(preparation.path, bytes, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (!error) return bytes;
  if (
    !z
      .object({ statusCode: z.union([z.literal('409'), z.literal(409)]) })
      .safeParse(error).success
  ) {
    throw new Error(
      'Could not store the prepared NOC PDF. Retry the issue operation.',
      {
        cause: error,
      },
    );
  }
  const { data: existing, error: downloadError } = await bucket.download(
    preparation.path,
  );
  if (downloadError || !existing) {
    throw new Error(
      'Could not verify the NOC from the previous issue attempt.',
      {
        cause: downloadError,
      },
    );
  }
  if (!Buffer.from(await existing.arrayBuffer()).equals(bytes)) {
    throw new ConflictError(
      'invalid_state',
      'The stored NOC does not match this issue attempt. Wait ten minutes, refresh and prepare a new NOC.',
    );
  }
  return bytes;
}
