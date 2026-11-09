// Verify the shared PostgreSQL extensions, private schema and trigger functions.
import { describe, expect, it } from 'vitest';
import { createTestDatabase, dbError, hasDatabase } from './support/database';

describe.skipIf(!hasDatabase)('database foundation', () => {
  it('installs the required extensions and restricts private schema access', async () => {
    const database = await createTestDatabase();
    try {
      const result = await database.asSuperuser((client) =>
        client.query<{
          extension: string;
          schema: string;
          anonymousPrivateUsage: boolean;
          privateCreate: boolean;
          authenticatedPrivateUsage: boolean;
          extensionUsage: boolean;
        }>(`
          select
            extension.extname as extension,
            namespace.nspname as schema,
            has_schema_privilege('anon', 'private', 'USAGE') as "anonymousPrivateUsage",
            has_schema_privilege('authenticated', 'private', 'CREATE') as "privateCreate",
            has_schema_privilege('authenticated', 'private', 'USAGE') as "authenticatedPrivateUsage",
            has_schema_privilege('service_role', 'extensions', 'USAGE') as "extensionUsage"
          from pg_extension as extension
          join pg_namespace as namespace on namespace.oid = extension.extnamespace
          where extension.extname in ('citext', 'pgcrypto')
          order by extension.extname
        `),
      );

      expect(
        result.rows.map(({ extension, schema }) => [extension, schema]),
      ).toEqual([
        ['citext', 'extensions'],
        ['pgcrypto', 'extensions'],
      ]);
      expect(result.rows[0]).toMatchObject({
        anonymousPrivateUsage: false,
        privateCreate: false,
        authenticatedPrivateUsage: true,
        extensionUsage: false,
      });
    } finally {
      await database.drop();
    }
  });

  it('updates updated_at through the shared trigger', async () => {
    const database = await createTestDatabase();
    try {
      const result = await database.asSuperuser(async (client) => {
        await client.query(`
          create temporary table trigger_timestamp_test (
            id integer primary key,
            updated_at timestamptz not null
          );
          create trigger set_updated_at
            before update on trigger_timestamp_test
            for each row execute function private.set_updated_at();
          insert into trigger_timestamp_test values (1, '2000-01-01T00:00:00Z');
        `);
        await client.query('update trigger_timestamp_test set id = 1');
        return client.query<{ updated_at: Date }>(
          'select updated_at from trigger_timestamp_test',
        );
      });

      expect(result.rows[0]?.updated_at.getTime()).toBeGreaterThan(
        new Date('2000-01-01T00:00:00Z').getTime(),
      );
    } finally {
      await database.drop();
    }
  });

  it.each(['update', 'delete'] as const)(
    'rejects %s through the shared append-only trigger',
    async (operation) => {
      const database = await createTestDatabase();
      try {
        const error = await dbError(
          database.asSuperuser(async (client) => {
            await client.query(`
              create temporary table append_only_test (id integer primary key);
              create trigger reject_mutation
                before update or delete on append_only_test
                for each row execute function private.reject_append_only_mutation();
              insert into append_only_test values (1);
            `);
            await client.query(
              operation === 'update'
                ? 'update append_only_test set id = 2'
                : 'delete from append_only_test',
            );
          }),
        );
        expect(error.code).toBe('55000');
      } finally {
        await database.drop();
      }
    },
  );
});
