// Verify every migration applies to a fresh database and the Supabase stand-in behaves like Supabase.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database smoke', () => {
  let database: TestDatabase | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database?.drop();
  });

  function db(): TestDatabase {
    if (!database) {
      throw new Error('The test database was not created.');
    }
    return database;
  }

  it('applies all migrations and exposes the public schema', async () => {
    const schemas = await db().asSuperuser((client) =>
      client.query<{ name: string }>(
        "select nspname as name from pg_namespace where nspname in ('public', 'auth') order by 1",
      ),
    );
    expect(schemas.rows.map((row) => row.name)).toEqual(['auth', 'public']);
  });

  it('reads the signed-in user from the request claims', async () => {
    const userId = await db().asSuperuser((client) => newAuthUser(client));
    const result = await db().asRole(
      'authenticated',
      { sub: userId },
      (client) => client.query<{ id: string }>('select auth.uid() as id'),
    );
    expect(result.rows[0]?.id).toBe(userId);
  });

  it('keeps the auth users table closed to API roles', async () => {
    const error = await dbError(
      db().asRole('anon', null, (client) =>
        client.query('select * from auth.users'),
      ),
    );
    expect(error.code).toBe('42501');
  });
});
