// Rebuild current access before rendering a Community & Marketplace page.
import 'server-only';
import { AppError, createRequestId } from '../errors';
import type { SocietyRole } from '../permissions';
import { buildRequestContext } from '../tenancy/request-context';

type CommunityPageState = 'disabled' | 'denied' | 'not-found';

export type CommunityPageResult<T> =
  { data: T; state: null } | { data: null; state: CommunityPageState };

export async function loadCommunityPage<T>(
  roles: readonly SocietyRole[],
  load: () => Promise<T>,
): Promise<CommunityPageResult<T>> {
  const context = await buildRequestContext(createRequestId());
  if (!context.enabledModules.has('community')) {
    return { data: null, state: 'disabled' };
  }
  if (!context.roles.some((role) => roles.includes(role))) {
    return { data: null, state: 'denied' };
  }
  try {
    return { data: await load(), state: null };
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'MODULE_DISABLED') {
        return { data: null, state: 'disabled' };
      }
      if (error.code === 'FORBIDDEN') {
        return { data: null, state: 'denied' };
      }
      if (error.code === 'NOT_FOUND') {
        return { data: null, state: 'not-found' };
      }
    }
    throw error;
  }
}
