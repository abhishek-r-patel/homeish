// Verify the IST-only upgrade preserves recorded instants.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database India time', () => {
  it('normalizes legacy society settings without changing recorded instants', async () => {
    const db = await createTestDatabase({ throughMigration: '20261125110000' });
    const id = crypto.randomUUID();
    try {
      const owner = await db.asSuperuser(async (client) => {
        const owner = await newAuthUser(client, 'india-time@example.test');
        await client.query(
          "insert into public.profiles(id, email, full_name) values ($1, 'india-time@example.test', 'India Time')",
          [owner],
        );
        await client.query(
          `insert into public.societies(id, name, timezone, created_by, created_at, updated_at)
           values ($1, 'India time test', 'America/New_York', $2,
                   '2026-01-31T18:29:59Z', '2026-01-31T18:30:00Z')`,
          [id, owner],
        );
        return owner;
      });
      await db.asDeployment((client) =>
        client.query(
          readFileSync(
            new URL(
              '../../supabase/migrations/20261125120000_core_india_time.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        ),
      );
      await db.asSuperuser(async (client) => {
        await client.query("set time zone 'America/Los_Angeles'");
        const { rows } = await client.query(
          `select timezone, created_at, updated_at from public.societies where id=$1`,
          [id],
        );
        expect(rows[0]).toEqual({
          timezone: 'Asia/Kolkata',
          created_at: new Date('2026-01-31T18:29:59Z'),
          updated_at: new Date('2026-01-31T18:30:00Z'),
        });
        const result = await client.query(
          `insert into public.societies(name, created_by) values ('Default timezone test', $1) returning timezone`,
          [owner],
        );
        expect(result.rows[0]?.timezone).toBe('Asia/Kolkata');
        expect(
          (
            await dbError(
              client.query(
                `insert into public.societies(name, timezone, created_by) values ('Wrong timezone test', 'UTC', $1)`,
                [owner],
              ),
            )
          ).message,
        ).toContain('societies_india_timezone_check');
      });
    } finally {
      await db.drop();
    }
  });
});
