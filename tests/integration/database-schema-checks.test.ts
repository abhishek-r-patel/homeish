// Verify the database-wide security and indexing invariants required by CI.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database schema checks', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('enables RLS and defines a policy on every public table', async () => {
    const violations = await database.asSuperuser((client) =>
      client.query<{
        table_name: string;
        rls_enabled: boolean;
        has_policy: boolean;
      }>(`
        SELECT tbl.relname AS table_name,
               tbl.relrowsecurity AS rls_enabled,
               EXISTS (
                 SELECT 1
                 FROM pg_catalog.pg_policy AS pol
                 WHERE pol.polrelid = tbl.oid
               ) AS has_policy
        FROM pg_catalog.pg_class AS tbl
        JOIN pg_catalog.pg_namespace AS ns
          ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = 'public'
          AND tbl.relkind IN ('r', 'p')
          AND (
            NOT tbl.relrowsecurity
            OR NOT EXISTS (
              SELECT 1
              FROM pg_catalog.pg_policy AS pol
              WHERE pol.polrelid = tbl.oid
            )
          )
        ORDER BY tbl.relname
      `),
    );

    expect(violations.rows).toEqual([]);
  });

  it('grants no table or column privileges to anon', async () => {
    const violations = await database.asSuperuser((client) =>
      client.query<{ table_name: string; privilege: string }>(`
        SELECT DISTINCT tbl.relname AS table_name,
                        table_privilege.privilege
        FROM pg_catalog.pg_class AS tbl
        JOIN pg_catalog.pg_namespace AS ns
          ON ns.oid = tbl.relnamespace
        CROSS JOIN LATERAL unnest(ARRAY[
          'SELECT', 'INSERT', 'UPDATE', 'DELETE',
          'TRUNCATE', 'REFERENCES', 'TRIGGER'
        ]) AS table_privilege(privilege)
        WHERE ns.nspname = 'public'
          AND tbl.relkind IN ('r', 'p')
          AND pg_catalog.has_table_privilege(
            'anon', tbl.oid, table_privilege.privilege
          )

        UNION

        SELECT DISTINCT tbl.relname AS table_name,
                        column_privilege.privilege
        FROM pg_catalog.pg_class AS tbl
        JOIN pg_catalog.pg_namespace AS ns
          ON ns.oid = tbl.relnamespace
        JOIN pg_catalog.pg_attribute AS attr
          ON attr.attrelid = tbl.oid
        CROSS JOIN LATERAL unnest(ARRAY[
          'SELECT', 'INSERT', 'UPDATE', 'REFERENCES'
        ]) AS column_privilege(privilege)
        WHERE ns.nspname = 'public'
          AND tbl.relkind IN ('r', 'p')
          AND attr.attnum > 0
          AND NOT attr.attisdropped
          AND pg_catalog.has_column_privilege(
            'anon', tbl.oid, attr.attnum, column_privilege.privilege
          )
        ORDER BY table_name, privilege
      `),
    );

    expect(violations.rows).toEqual([]);
  });

  it('requires society_id and a leading society index on tenant tables', async () => {
    const violations = await database.asSuperuser((client) =>
      client.query<{
        table_name: string;
        has_society_id: boolean;
        has_leading_society_index: boolean;
      }>(`
        SELECT tbl.relname AS table_name,
               society_column.attnum IS NOT NULL AS has_society_id,
               EXISTS (
                 SELECT 1
                 FROM pg_catalog.pg_index AS idx
                 CROSS JOIN LATERAL
                   unnest(idx.indkey) WITH ORDINALITY AS idx_col(attnum, position)
                 WHERE idx.indrelid = tbl.oid
                   AND idx.indisvalid
                   AND idx.indisready
                   AND idx.indislive
                   AND idx.indpred IS NULL
                   AND idx_col.position = 1
                   AND idx_col.attnum = society_column.attnum
               ) AS has_leading_society_index
        FROM pg_catalog.pg_class AS tbl
        JOIN pg_catalog.pg_namespace AS ns
          ON ns.oid = tbl.relnamespace
        LEFT JOIN pg_catalog.pg_attribute AS society_column
          ON society_column.attrelid = tbl.oid
          AND society_column.attname = 'society_id'
          AND society_column.attnum > 0
          AND NOT society_column.attisdropped
        WHERE ns.nspname = 'public'
          AND tbl.relkind IN ('r', 'p')
          AND tbl.relname NOT IN (
            'profiles', 'developers', 'societies', 'modules', 'rate_limits',
            'auth_code_challenges'
          )
          AND (
            society_column.attnum IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM pg_catalog.pg_index AS idx
              CROSS JOIN LATERAL
                unnest(idx.indkey) WITH ORDINALITY AS idx_col(attnum, position)
              WHERE idx.indrelid = tbl.oid
                AND idx.indisvalid
                AND idx.indisready
                AND idx.indislive
                AND idx.indpred IS NULL
                AND idx_col.position = 1
                AND idx_col.attnum = society_column.attnum
            )
          )
        ORDER BY tbl.relname
      `),
    );

    expect(violations.rows).toEqual([]);
  });

  it('indexes every public foreign key by its leading columns', async () => {
    const violations = await database.asSuperuser((client) =>
      client.query<{ table_name: string; constraint_name: string }>(`
        SELECT tbl.relname AS table_name,
               fk.conname AS constraint_name
        FROM pg_catalog.pg_constraint AS fk
        JOIN pg_catalog.pg_class AS tbl
          ON tbl.oid = fk.conrelid
        JOIN pg_catalog.pg_namespace AS ns
          ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = 'public'
          AND fk.contype = 'f'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_index AS idx
            WHERE idx.indrelid = tbl.oid
              AND idx.indisvalid
              AND idx.indisready
              AND idx.indislive
              AND idx.indnkeyatts >= cardinality(fk.conkey)
              AND (
                SELECT array_agg(idx_col.attnum ORDER BY idx_col.position)
                FROM unnest(idx.indkey) WITH ORDINALITY
                  AS idx_col(attnum, position)
                WHERE idx_col.position <= cardinality(fk.conkey)
              ) = fk.conkey
              AND (
                idx.indpred IS NULL
                OR regexp_replace(
                  pg_catalog.pg_get_expr(idx.indpred, idx.indrelid),
                  '[()]',
                  '',
                  'g'
                ) = (
                  SELECT string_agg(
                    pg_catalog.format('%I IS NOT NULL', fk_attr.attname),
                    ' AND '
                    ORDER BY fk_column.position
                  )
                  FROM unnest(fk.conkey) WITH ORDINALITY
                    AS fk_column(attnum, position)
                  JOIN pg_catalog.pg_attribute AS fk_attr
                    ON fk_attr.attrelid = fk.conrelid
                    AND fk_attr.attnum = fk_column.attnum
                )
              )
          )
        ORDER BY tbl.relname, fk.conname
      `),
    );

    expect(violations.rows).toEqual([]);
  });

  it('protects append-only audit logs with a rejecting mutation trigger', async () => {
    const triggers = await database.asSuperuser((client) =>
      client.query<{ table_name: string }>(`
        WITH append_only_table(table_name) AS (
          VALUES ('audit_logs')
        )
        SELECT expected.table_name
        FROM append_only_table AS expected
        LEFT JOIN pg_catalog.pg_class AS tbl
          ON tbl.relname = expected.table_name
          AND tbl.relnamespace = 'public'::regnamespace
        WHERE tbl.oid IS NULL
          OR tbl.relkind NOT IN ('r', 'p')
          OR NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger AS trg
            WHERE trg.tgrelid = tbl.oid
              AND NOT trg.tgisinternal
              AND trg.tgfoid =
                'private.reject_append_only_mutation()'::regprocedure
              AND (trg.tgtype & 2) = 2
              AND (trg.tgtype & 8) = 8
              AND (trg.tgtype & 16) = 16
          )
      `),
    );

    expect(triggers.rows).toEqual([]);
  });
});
