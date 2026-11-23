// Issue and authorize private amenity deposit evidence paths.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, ValidationError } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import {
  AMENITY_DEPOSIT_EVIDENCE_TYPES,
  amenityDepositEvidencePathSchema,
  amenityDepositUploadInputSchema,
} from './validation';

export async function prepareAmenityDepositEvidenceUpload(
  context: RequestContext,
  input: unknown,
) {
  authorizeRequest(context, {
    moduleKey: 'amenity',
    permission: 'amenity:manage',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const value = parseModuleInput(amenityDepositUploadInputSchema, input);
  const allowed = await callModuleRpc(
    context,
    'amenity_deposit_file_access',
    {
      p_society_id: context.societyId,
      p_booking_id: value.bookingId,
      p_upload: true,
    },
    z.boolean(),
    'Could not authorize the booking deposit evidence.',
  );
  if (!allowed) throw new AppError('FORBIDDEN');
  const extension =
    value.contentType === 'image/jpeg'
      ? 'jpg'
      : value.contentType === 'image/png'
        ? 'png'
        : 'pdf';
  if (
    !AMENITY_DEPOSIT_EVIDENCE_TYPES.some((type) => type === value.contentType)
  )
    throw new ValidationError({
      contentType: 'Choose a JPG, PNG or PDF.',
    });
  return `${context.societyId}/amenity-deposits/${value.bookingId}/${crypto.randomUUID()}.${extension}`;
}

export async function authoriseAmenityDepositEvidenceView(
  context: RequestContext,
  path: string,
) {
  const parsed = parseModuleInput(amenityDepositEvidencePathSchema, path);
  if (!context.societyId || parsed.split('/')[0] !== context.societyId)
    throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'amenity',
    permission: 'amenity:list',
  });
  const allowed = await callModuleRpc(
    context,
    'amenity_deposit_file_path_access',
    { p_path: parsed },
    z.boolean(),
    'Could not verify access to the deposit evidence.',
  );
  if (!allowed) throw new AppError('NOT_FOUND');
}
