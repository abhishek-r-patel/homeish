// Rebuild standard-member and outside-officer contexts for P46 operations.
import 'server-only';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';

type ElectionPermission = 'poll:list' | 'poll:manage' | 'poll:vote';

export async function getElectionContext(
  permission: ElectionPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'poll',
    permission,
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

export async function getElectionOfficerContext(
  requestId: string,
  write = false,
) {
  const context = await buildRequestContext(requestId);
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return context;
}

export async function signElectionDisputeFile(
  context: RequestContext,
  path: string | null,
) {
  if (!path) return null;
  const { data, error } = await context.db.storage
    .from('poll-dispute-files')
    .createSignedUrl(path, 300);
  if (error || !data) {
    throw new Error('Could not open the private election dispute file.', {
      cause: error,
    });
  }
  return data.signedUrl;
}
