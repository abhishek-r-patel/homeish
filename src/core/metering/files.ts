// Issue private meter-reading photo paths and authorise signed views through the database.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError } from '../errors';
import { hasPermission } from '../permissions';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import {
  meteringPhotoPathSchema,
  meteringPhotoUploadInputSchema,
} from './validation';

function uploadPermission(context: RequestContext) {
  return hasPermission(context.roles, 'metering', 'metering:record')
    ? 'metering:record'
    : 'metering:submit';
}

export async function prepareMeteringPhotoUpload(
  context: RequestContext,
  input: { contentType: string; sizeBytes: number },
) {
  authorizeRequest(context, {
    moduleKey: 'metering',
    permission: uploadPermission(context),
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const file = parseModuleInput(meteringPhotoUploadInputSchema, input);
  return callModuleRpc(
    context,
    'metering_photo_upload_path',
    {
      p_society_id: context.societyId,
      p_content_type: file.contentType,
      p_size_bytes: file.sizeBytes,
    },
    meteringPhotoPathSchema,
    'The photo upload is unavailable. Use a JPG or PNG up to 5 MiB.',
  );
}

export async function authoriseMeteringPhotoView(
  context: RequestContext,
  inputPath: string,
) {
  authorizeRequest(context, {
    moduleKey: 'metering',
    permission: hasPermission(context.roles, 'metering', 'metering:list')
      ? 'metering:list'
      : 'metering:record',
  });
  const path = parseModuleInput(meteringPhotoPathSchema, inputPath);
  const societyId = path.split('/')[0];
  if (!societyId || societyId !== context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  const allowed = await callModuleRpc(
    context,
    'metering_photo_access',
    { p_society_id: societyId, p_path: path },
    z.boolean(),
    'Could not verify access to this meter photo. Refresh and retry.',
  );
  if (!allowed) throw new AppError('NOT_FOUND');
}
