// Check database availability without exposing operational table contents.
import { privilegedClient } from './server-client';

export async function checkDatabaseHealth(): Promise<void> {
  const { error } = await privilegedClient
    .from('rate_limits')
    .select('key')
    .limit(1)
    .abortSignal(AbortSignal.timeout(2_000));
  if (error) {
    throw new Error('Database health check failed.', { cause: error });
  }
}
