// Read and save the audited society managing-body display name.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { callModuleRpc } from '../db/validated-rpc';
import { buildRequestContext, type RequestContext } from './request-context';

const managingBodySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z ]{1,24}$/, 'Use 1 to 24 letters or spaces.');

export async function getManagingBodyName(context?: RequestContext) {
  const resolvedContext =
    context ?? (await buildRequestContext(createRequestId()));
  if (!resolvedContext.societyId) throw new AppError('FORBIDDEN');
  return callModuleRpc(
    resolvedContext,
    'society_managing_body_name_get',
    { p_society_id: resolvedContext.societyId },
    z.string(),
    'Could not load the managing-body name.',
  );
}

export async function saveManagingBodyName(input: unknown) {
  const parsed = managingBodySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ name: parsed.error.issues[0]?.message });
  }
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId || !context.roles.includes('admin')) {
    throw new AppError('FORBIDDEN');
  }
  const { error } = await context.db.rpc('society_managing_body_name_save', {
    p_society_id: context.societyId,
    p_name: parsed.data,
  });
  if (error) {
    if (error.code === '42501') throw new AppError('FORBIDDEN');
    if (error.code === '23514' || error.code === '22023') {
      throw new ValidationError({ name: 'Use 1 to 24 letters or spaces.' });
    }
    throw new Error('Could not save the managing-body name.', {
      cause: error,
    });
  }
}
