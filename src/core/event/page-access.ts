// Rebuild current access before rendering an Events & RSVPs page.
import 'server-only';
import { AppError, createRequestId } from '../errors';
import type { SocietyRole } from '../permissions';
import { buildRequestContext } from '../tenancy/request-context';

type EventPageState = 'disabled' | 'denied' | 'not-found';

export type EventPageResult<T> =
  { data: T; state: null } | { data: null; state: EventPageState };

export async function loadEventPage<T>(
  roles: readonly SocietyRole[],
  load: () => Promise<T>,
): Promise<EventPageResult<T>> {
  const context = await buildRequestContext(createRequestId());
  if (!context.enabledModules.has('event')) {
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
