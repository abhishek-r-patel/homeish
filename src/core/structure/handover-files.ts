// Issue and authorize private D-85 unit-handover file paths.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import { handoverFileUploadInputSchema } from './handover-validation';

export async function prepareHandoverFileUpload(
  context: RequestContext,
  input: unknown,
) {
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:manage',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const value = parseModuleInput(handoverFileUploadInputSchema, input);
  return callModuleRpc(
    context,
    'unit_handover_photo_upload_path',
    {
      p_society_id: context.societyId,
      p_handover_id: value.handoverId,
      p_content_type: value.contentType,
      p_size_bytes: value.sizeBytes,
    },
    z.string(),
    'Use a JPG, PNG or PDF of at most 5 MiB for an open handover.',
  );
}

export async function authoriseHandoverFileView(
  context: RequestContext,
  path: string,
) {
  if (!context.societyId || path.split('/')[0] !== context.societyId)
    throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:read',
  });
  const allowed = await callModuleRpc(
    context,
    'unit_handover_file_access',
    { p_society_id: context.societyId, p_path: path },
    z.boolean(),
    'Could not verify access to this handover file.',
  );
  if (!allowed) throw new AppError('NOT_FOUND');
}
