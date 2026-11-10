// Increment fixed-window counters atomically using the service-only database RPC.
import type { Database } from '../db/database.types';
import { privilegedClient } from './server-client';

type RateLimitResult =
  Database['public']['Functions']['consume_rate_limit']['Returns'][number];

export async function consumeRateLimitKey(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await privilegedClient.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    throw new Error('Rate-limit store is unavailable.', { cause: error });
  }
  const result = data[0];
  if (!result) {
    throw new Error('Rate-limit store returned no counter result.');
  }
  return result;
}
