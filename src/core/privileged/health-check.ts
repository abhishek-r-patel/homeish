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

export async function checkDailyJobHealth(): Promise<void> {
  const { data, error } = await privilegedClient.rpc(
    'daily_job_health_summary',
  );
  if (error) {
    throw new Error('Daily job health check failed.', { cause: error });
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data) ||
    data.isFresh !== true
  ) {
    throw new Error('Daily jobs have not completed within the last 36 hours.');
  }
}
