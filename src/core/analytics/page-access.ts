// Rebuild current access before rendering an analytics page, turning refusals into page states.
import 'server-only';
import { AppError } from '../errors';

export type AnalyticsPageState = 'denied' | 'archived';

export type AnalyticsPageResult<T> =
  { data: T; state: null } | { data: null; state: AnalyticsPageState };

export async function loadAnalyticsPage<T>(
  load: () => Promise<T>,
): Promise<AnalyticsPageResult<T>> {
  try {
    return { data: await load(), state: null };
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'FORBIDDEN') return { data: null, state: 'denied' };
      if (error.code === 'SOCIETY_ARCHIVED') {
        return { data: null, state: 'archived' };
      }
    }
    throw error;
  }
}
