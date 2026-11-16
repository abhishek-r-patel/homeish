// Issue private patrol incident photo paths and authorise signed views through the database.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError } from '../errors';
import { hasPermission } from '../permissions';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import {
  patrolPhotoPathSchema,
  patrolPhotoUploadInputSchema,
} from './validation';

export async function preparePatrolPhotoUpload(
  context: RequestContext,
  input: { contentType: string; sizeBytes: number },
) {
  authorizeRequest(context, {
    moduleKey: 'patrol',
    permission: 'patrol:guard',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const file = parseModuleInput(patrolPhotoUploadInputSchema, input);
  return callModuleRpc(
    context,
    'patrol_photo_upload_path',
    {
      p_society_id: context.societyId,
      p_content_type: file.contentType,
      p_size_bytes: file.sizeBytes,
    },
    patrolPhotoPathSchema,
    'The photo upload is unavailable. Use a JPG or PNG up to 5 MiB.',
  );
}

export async function authorisePatrolPhotoView(
  context: RequestContext,
  inputPath: string,
) {
  authorizeRequest(context, {
    moduleKey: 'patrol',
    permission: hasPermission(context.roles, 'patrol', 'patrol:list')
      ? 'patrol:list'
      : 'patrol:guard',
  });
  const path = parseModuleInput(patrolPhotoPathSchema, inputPath);
  const societyId = path.split('/')[0];
  if (!societyId || societyId !== context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  const allowed = await callModuleRpc(
    context,
    'patrol_photo_access',
    { p_society_id: societyId, p_path: path },
    z.boolean(),
    'Could not verify access to this incident photo. Refresh and retry.',
  );
  if (!allowed) throw new AppError('NOT_FOUND');
}
