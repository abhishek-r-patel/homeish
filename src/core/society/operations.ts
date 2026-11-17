// Manage the society code used by the self-registration flow.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import type { RequestContext } from '../tenancy/request-context';

const hindiAvailabilityInputSchema = z
  .object({
    hindiAvailable: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true'),
    expectedVersion: z.string().datetime({ offset: true }),
  })
  .strict();
const hindiAvailabilityResultSchema = z
  .object({
    hindi_available: z.boolean(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

async function getSocietyManagerContext(
  write = false,
  existingContext?: RequestContext,
) {
  const context =
    existingContext ?? (await buildRequestContext(createRequestId()));
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'membership:manage',
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function raiseSocietyRpcError(error: unknown, label: string): never {
  const cause =
    error instanceof Error && typeof error.cause === 'object' && error.cause
      ? (error.cause as { code?: string })
      : null;
  if (cause?.code === '42501') throw new AppError('FORBIDDEN');
  if (cause?.code === 'P0002') throw new AppError('NOT_FOUND');
  throw new Error(label, { cause: error });
}

export async function getJoinCodeSettings(
  existingContext?: RequestContext,
): Promise<{
  joinCode: string | null;
}> {
  const { context, societyId } = await getSocietyManagerContext(
    false,
    existingContext,
  );
  try {
    return {
      joinCode: await invokeUntypedRpc<string | null>(
        context.db,
        'get_society_join_code',
        { p_society_id: societyId },
      ),
    };
  } catch (error) {
    raiseSocietyRpcError(
      error,
      'Could not load society registration settings.',
    );
  }
}

export async function getHindiAvailability(
  existingContext?: RequestContext,
): Promise<{
  canManage: boolean;
  hindiAvailable: boolean;
  version: string;
}> {
  const context =
    existingContext ?? (await buildRequestContext(createRequestId()));
  authorizeRequest(context, {
    moduleKey: 'language',
    permission: 'language:read',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');

  const { data, error } = await context.db
    .from('societies')
    .select('hindi_available, updated_at')
    .eq('id', context.societyId)
    .single();
  if (error) {
    throw new Error('Could not load society language settings.', {
      cause: error,
    });
  }
  return {
    canManage: context.roles.includes('admin'),
    hindiAvailable: data.hindi_available,
    version: data.updated_at,
  };
}

export async function updateHindiAvailability(
  input: unknown,
  requestId: string,
): Promise<{ hindiAvailable: boolean; version: string }> {
  const parsed = parseModuleInput(hindiAvailabilityInputSchema, input);
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'language',
    permission: 'language:manage',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');

  const result = await callModuleRpc(
    context,
    'admin_set_hindi_availability',
    {
      p_society_id: context.societyId,
      p_hindi_available: parsed.hindiAvailable,
      p_expected_updated_at: parsed.expectedVersion,
      p_request_id: context.requestId,
    },
    hindiAvailabilityResultSchema,
    'Could not update society language settings.',
  );
  return {
    hindiAvailable: result.hindi_available,
    version: result.updated_at,
  };
}

export async function rotateJoinCode(requestId: string): Promise<string> {
  const { context, societyId } = await getSocietyManagerContext(true);
  try {
    return await invokeUntypedRpc<string>(
      context.db,
      'rotate_society_join_code',
      {
        p_society_id: societyId,
        p_request_id: requestId,
      },
    );
  } catch (error) {
    raiseSocietyRpcError(error, 'Could not rotate the society join code.');
  }
}

export async function disableJoinCode(requestId: string): Promise<void> {
  const { context, societyId } = await getSocietyManagerContext(true);
  try {
    await invokeUntypedRpc<void>(context.db, 'disable_society_join_code', {
      p_society_id: societyId,
      p_request_id: requestId,
    });
  } catch (error) {
    raiseSocietyRpcError(error, 'Could not disable the society join code.');
  }
}
