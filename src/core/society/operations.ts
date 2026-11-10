// Manage the society code used by the self-registration flow.
import 'server-only';
import { AppError, createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';

async function getSocietyManagerContext(write = false) {
  const context = await buildRequestContext(createRequestId());
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

export async function getJoinCodeSettings(): Promise<{
  joinCode: string | null;
}> {
  const { context, societyId } = await getSocietyManagerContext();
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
