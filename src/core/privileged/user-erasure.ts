// Remove auth access while keeping an anonymized profile for historical foreign keys.
import 'server-only';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

function hasAuthAccount(
  value: unknown,
): value is { authAccountPresent: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'authAccountPresent' in value &&
    typeof value.authAccountPresent === 'boolean'
  );
}

function isErasureComplete(
  value: unknown,
): value is { completed: true; profileStatus: 'anonymized' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'completed' in value &&
    value.completed === true &&
    'profileStatus' in value &&
    value.profileStatus === 'anonymized'
  );
}

export async function runUserErasurePrivileged(
  userId: string,
  actorId: string,
  requestId: string,
): Promise<void> {
  const preparation = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'user_erasure_prepare',
    {
      p_user_id: userId,
      p_actor_id: actorId,
      p_request_id: requestId,
    },
  );
  if (!hasAuthAccount(preparation)) {
    throw new Error('User erasure preparation returned an invalid response.');
  }

  if (preparation.authAccountPresent) {
    const { error } = await privilegedClient.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error('Could not delete the auth account for user erasure.', {
        cause: error,
      });
    }
  }

  const completion = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'user_erasure_complete',
    {
      p_user_id: userId,
      p_actor_id: actorId,
      p_request_id: requestId,
    },
  );
  if (!isErasureComplete(completion)) {
    throw new Error('User erasure completion returned an invalid response.');
  }
}
