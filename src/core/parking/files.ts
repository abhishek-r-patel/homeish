// Issue private parking photo paths and authorise signed views through the database.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError } from '../errors';
import { hasPermission } from '../permissions';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import {
  parkingPhotoPathSchema,
  parkingPhotoUploadInputSchema,
} from './validation';

export async function prepareParkingPhotoUpload(
  context: RequestContext,
  input: { contentType: string; sizeBytes: number },
) {
  authorizeRequest(context, {
    moduleKey: 'parking',
    permission: 'parking:report',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const file = parseModuleInput(parkingPhotoUploadInputSchema, input);
  return callModuleRpc(
    context,
    'parking_photo_upload_path',
    {
      p_society_id: context.societyId,
      p_content_type: file.contentType,
      p_size_bytes: file.sizeBytes,
    },
    parkingPhotoPathSchema,
    'The photo upload is unavailable. Use a JPG or PNG up to 5 MiB.',
  );
}

export async function authoriseParkingPhotoView(
  context: RequestContext,
  inputPath: string,
) {
  authorizeRequest(context, {
    moduleKey: 'parking',
    permission: hasPermission(context.roles, 'parking', 'parking:list')
      ? 'parking:list'
      : 'parking:report',
  });
  const path = parseModuleInput(parkingPhotoPathSchema, inputPath);
  const societyId = path.split('/')[0];
  if (!societyId || societyId !== context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  const allowed = await callModuleRpc(
    context,
    'parking_photo_access',
    { p_society_id: societyId, p_path: path },
    z.boolean(),
    'Could not verify access to this parking photo. Refresh and retry.',
  );
  if (!allowed) throw new AppError('NOT_FOUND');
}
