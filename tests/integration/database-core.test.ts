// Verify the core identity, society and module tables enforce their schema and RLS.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('core database tables', () => {
  it('seeds all supported modules and protects the core module from disabling', async () => {
    const database = await createTestDatabase();
    try {
      const modules = await database.asSuperuser((client) =>
        client.query<{ key: string; is_core: boolean }>(
          'select key, is_core from public.modules order by sort_order',
        ),
      );
      expect(modules.rows).toEqual([
        { key: 'core', is_core: true },
        { key: 'visitor', is_core: false },
        { key: 'delivery', is_core: false },
        { key: 'billing', is_core: false },
        { key: 'service_request', is_core: false },
        { key: 'staff', is_core: false },
        { key: 'housekeeping', is_core: false },
        { key: 'amc', is_core: false },
        { key: 'notice', is_core: false },
        { key: 'amenity', is_core: false },
      ]);

      const userId = await database.asSuperuser((client) =>
        newAuthUser(client),
      );
      const societyId = await database.asSuperuser(async (client) => {
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [userId, `${userId}@example.test`, 'Test Admin'],
        );
        const society = await client.query<{ id: string }>(
          'insert into public.societies (name, created_by) values ($1, $2) returning id',
          ['Test Society', userId],
        );
        return society.rows[0]?.id;
      });
      expect(societyId).toBeDefined();
      const error = await dbError(
        database.asSuperuser((client) =>
          client.query(
            'insert into public.module_configs (society_id, module_key, enabled) values ($1, $2, false)',
            [societyId, 'core'],
          ),
        ),
      );
      expect(error.code).toBe('23514');
    } finally {
      await database.drop();
    }
  });

  it('limits profile access to the signed-in user and editable columns', async () => {
    const database = await createTestDatabase();
    try {
      const ids = await database.asSuperuser(async (client) => {
        const first = await newAuthUser(client);
        const second = await newAuthUser(client);
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, 'First'), ($3, $4, 'Second')`,
          [first, `${first}@example.test`, second, `${second}@example.test`],
        );
        return { first, second };
      });

      const profiles = await database.asRole(
        'authenticated',
        { sub: ids.first },
        (client) => client.query('select id from public.profiles'),
      );
      expect(profiles.rows).toEqual([{ id: ids.first }]);

      const error = await dbError(
        database.asRole('authenticated', { sub: ids.first }, (client) =>
          client.query(
            "update public.profiles set status = 'disabled' where id = $1",
            [ids.first],
          ),
        ),
      );
      expect(error.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('does not grant anonymous access to core tables and exposes only module reference reads', async () => {
    const database = await createTestDatabase();
    try {
      const userId = await database.asSuperuser((client) =>
        newAuthUser(client),
      );
      const modules = await database.asRole(
        'authenticated',
        { sub: userId },
        (client) => client.query('select key from public.modules order by key'),
      );
      expect(modules.rowCount).toBe(10);

      const profileError = await dbError(
        database.asRole('anon', null, (client) =>
          client.query('select * from public.profiles'),
        ),
      );
      expect(profileError.code).toBe('42501');

      const developerError = await dbError(
        database.asRole('authenticated', { sub: userId }, (client) =>
          client.query('select * from public.developers'),
        ),
      );
      expect(developerError.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('rejects invalid core values and duplicate society join codes', async () => {
    const database = await createTestDatabase();
    try {
      const userId = await database.asSuperuser(async (client) => {
        const id = await newAuthUser(client);
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [id, `${id}@example.test`, 'Test Admin'],
        );
        return id;
      });

      const badFont = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.profiles (id, email, full_name, font_preference)
             values ($1, $2, 'Bad Font', 'comic_sans')`,
            ['00000000-0000-0000-0000-000000000001', 'bad-font@example.test'],
          ),
        ),
      );
      expect(badFont.code).toBe('23514');

      const badUnitLabel = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.societies (name, unit_label, created_by)
             values ('Test Society', 'Unit 1', $1)`,
            [userId],
          ),
        ),
      );
      expect(badUnitLabel.code).toBe('23514');

      await database.asSuperuser((client) =>
        client.query(
          `insert into public.societies (name, created_by, join_code)
           values ('First Society', $1, 'ABCD2345')`,
          [userId],
        ),
      );
      const duplicateJoinCode = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.societies (name, created_by, join_code)
             values ('Second Society', $1, 'ABCD2345')`,
            [userId],
          ),
        ),
      );
      expect(duplicateJoinCode.code).toBe('23505');
    } finally {
      await database.drop();
    }
  });
});
