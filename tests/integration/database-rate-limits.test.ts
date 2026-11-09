// Verify rate-limit increments are atomic and callable only by the service role.
import { describe, expect, it } from 'vitest';
import { createTestDatabase, dbError, hasDatabase } from './support/database';

describe.skipIf(!hasDatabase)('database rate limits', () => {
  it('increments a fixed-window counter atomically under concurrent calls', async () => {
    const database = await createTestDatabase();
    try {
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          database.asRole(
            'service_role',
            null,
            (client) =>
              client.query<{
                allowed: boolean;
                count: number;
                retry_after_seconds: number;
              }>(
                `select *
                 from public.consume_rate_limit($1, $2, $3)`,
                ['test:hashed-identity', 5, 60],
              ),
            { commit: true },
          ),
        ),
      );
      const results = attempts.map((result) => result.rows[0]);
      expect(results).toHaveLength(8);
      expect(
        results.map((result) => result?.count).sort((a, b) => a - b),
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(results.filter((result) => result?.allowed)).toHaveLength(5);
      expect(
        results.every(
          (result) =>
            result?.retry_after_seconds !== undefined &&
            result.retry_after_seconds >= 1 &&
            result.retry_after_seconds <= 60,
        ),
      ).toBe(true);

      const stored = await database.asSuperuser((client) =>
        client.query<{ count: number }>(
          `select count
           from public.rate_limits
           where key = 'test:hashed-identity'`,
        ),
      );
      expect(stored.rows).toHaveLength(1);
      expect(stored.rows[0]?.count).toBe(8);
    } finally {
      await database.drop();
    }
  });

  it('rejects invalid limits and denies direct API-role execution', async () => {
    const database = await createTestDatabase();
    try {
      const invalid = await dbError(
        database.asRole('service_role', null, (client) =>
          client.query(
            `select *
             from public.consume_rate_limit('test:invalid', 0, 60)`,
          ),
        ),
      );
      expect(invalid.code).toBe('22023');

      for (const role of ['anon', 'authenticated'] as const) {
        const denied = await dbError(
          database.asRole(role, null, (client) =>
            client.query(
              `select *
               from public.consume_rate_limit('test:denied', 1, 60)`,
            ),
          ),
        );
        expect(denied.code).toBe('42501');
      }
    } finally {
      await database.drop();
    }
  });
});
