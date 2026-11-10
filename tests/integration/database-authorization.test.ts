// Verify authorization helper stubs fail closed until their backing tables exist.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database authorization helpers', () => {
  it('fails closed for missing membership, roles and developer records', async () => {
    const database = await createTestDatabase();
    try {
      const userId = await database.asSuperuser((client) =>
        newAuthUser(client),
      );
      const result = await database.asRole(
        'authenticated',
        { sub: userId },
        (client) =>
          client.query<{
            developer: boolean;
            member: boolean;
            role: boolean;
            core: boolean;
            disabledModule: boolean;
            writable: boolean;
          }>(
            `
              select
                private.is_developer() as developer,
                private.is_member($1) as member,
                private.has_role($1, array['admin']::text[]) as role,
                private.module_enabled($1, 'core') as core,
                private.module_enabled($1, 'visitor') as "disabledModule",
                private.society_writable($1) as writable
            `,
            ['00000000-0000-0000-0000-000000000001'],
          ),
      );

      expect(result.rows[0]).toEqual({
        developer: false,
        member: false,
        role: false,
        core: true,
        disabledModule: false,
        writable: false,
      });
    } finally {
      await database.drop();
    }
  });

  it('does not expose private helpers to anonymous requests', async () => {
    const database = await createTestDatabase();
    try {
      const error = await dbError(
        database.asRole('anon', null, (client) =>
          client.query(
            "select private.is_member('00000000-0000-0000-0000-000000000001')",
          ),
        ),
      );
      expect(error.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
