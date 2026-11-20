// Install every migration and its history into an empty database (optionally wiping testdb first) in one transaction.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { databasePoolOptions } from './integrity-check.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TESTDB_REF = 'oqyagsabodaueghtrocv';
const WIPE_FLAG = '--wipe-testdb';
const TLS_PARAMETERS = new Set([
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'sslpassword',
  'sslnegotiation',
  'uselibpqcompat',
]);

export class FreshInstallError extends Error {}

export function parseFreshInstallArgs(args) {
  if (args.length === 0) return { wipe: false };
  if (args.length === 1 && args[0] === WIPE_FLAG) return { wipe: true };
  throw new FreshInstallError(
    `Usage: node scripts/db.mjs fresh-install [${WIPE_FLAG}]`,
  );
}

export function testdbSessionUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new FreshInstallError('Invalid testdb session pooler address.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.username !== `postgres.${TESTDB_REF}` ||
    !url.password ||
    url.password === '__SET_DB_PASSWORD__' ||
    !/^aws-\d+-ap-south-1\.pooler\.supabase\.com$/.test(url.hostname) ||
    !['', '5432'].includes(url.port) ||
    url.pathname !== '/postgres' ||
    url.hash ||
    [...url.searchParams.keys()].some((key) => !TLS_PARAMETERS.has(key))
  ) {
    throw new FreshInstallError(
      'Refusing to wipe: the address is not the expected testdb session pooler.',
    );
  }
  return url;
}

export function readMigrations(directory) {
  let files;
  try {
    files = readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (error) {
    throw new FreshInstallError(
      `Could not read the migration files${databaseErrorCode(error)}.`,
    );
  }
  if (
    files.length === 0 ||
    files.some((file) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(file))
  ) {
    throw new FreshInstallError(
      'Migration files are missing or badly named; run npm run check.',
    );
  }
  return files.map((file) => ({
    file,
    version: file.slice(0, 14),
    name: file.slice(15, -4),
    sql: readFileSync(join(directory, file), 'utf8'),
  }));
}

function databaseErrorCode(error) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' && /^[A-Z0-9_]{3,40}$/.test(code)
    ? ` (${code})`
    : '';
}

// Removes only what the migrations create; Supabase-managed schemas, grants and default privileges stay.
const WIPE_SQL = `
DO $wipe$
DECLARE
  item record;
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'Stored files exist; remove them through Supabase Storage before wiping.';
  END IF;
  FOR item IN
    SELECT policyname FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', item.policyname);
  END LOOP;
  -- Supabase blocks direct bucket deletes to avoid orphaned files; the check above proved there are none.
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.buckets;
  PERFORM set_config('storage.allow_delete_query', 'false', true);

  DROP SCHEMA IF EXISTS private CASCADE;
  FOR item IN
    SELECT format('%I.%I', n.nspname, c.relname) AS name, c.relkind
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
      AND c.relowner = current_user::regrole
    ORDER BY c.relkind IN ('r', 'p') DESC
  LOOP
    EXECUTE format(
      'DROP %s IF EXISTS %s CASCADE',
      CASE item.relkind
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
        WHEN 'f' THEN 'FOREIGN TABLE'
        WHEN 'S' THEN 'SEQUENCE'
        ELSE 'TABLE'
      END,
      item.name
    );
  END LOOP;
  FOR item IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)) AS name, p.prokind
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proowner = current_user::regrole
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend d
        WHERE d.classid = 'pg_catalog.pg_proc'::regclass
          AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'DROP %s IF EXISTS %s CASCADE',
      CASE item.prokind
        WHEN 'p' THEN 'PROCEDURE'
        WHEN 'a' THEN 'AGGREGATE'
        ELSE 'FUNCTION'
      END,
      item.name
    );
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', n.nspname, t.typname) AS name, t.typtype
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typowner = current_user::regrole
      AND t.typtype IN ('e', 'd', 'c', 'r', 'm')
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        WHERE c.reltype = t.oid AND c.relkind <> 'c'
      )
  LOOP
    EXECUTE format(
      'DROP %s IF EXISTS %s CASCADE',
      CASE item.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END,
      item.name
    );
  END LOOP;

  DELETE FROM auth.users;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    DELETE FROM supabase_migrations.schema_migrations;
  END IF;
END
$wipe$;
`;

const LEFTOVERS_SQL = `
SELECT
  (SELECT count(*) FROM pg_catalog.pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind <> 'i')
  + (SELECT count(*) FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace)
  + (SELECT count(*) FROM pg_catalog.pg_type t
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typtype IN ('e', 'd', 'c', 'r', 'm')
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        WHERE c.reltype = t.oid AND c.relkind <> 'c'
      )) AS public_objects,
  (to_regnamespace('private') IS NOT NULL)::int AS private_schema,
  (SELECT count(*) FROM storage.buckets) AS buckets,
  (SELECT count(*) FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects') AS storage_policies,
  (SELECT count(*) FROM auth.users) AS users,
  (SELECT count(*) FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal) AS auth_triggers
`;

const HISTORY_SQL = `
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
`;

async function assertEmpty(client) {
  const leftovers = (await client.query(LEFTOVERS_SQL)).rows[0];
  const history = await client.query(
    `SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
       THEN 0 ELSE (SELECT count(*) FROM supabase_migrations.schema_migrations) END
       AS history`,
  );
  const found = Object.entries({
    ...leftovers,
    history: history.rows[0].history,
  }).filter(([, count]) => Number(count) !== 0);
  if (found.length > 0) {
    throw new FreshInstallError(
      `The database is not empty (${found.map(([name, count]) => `${name}: ${count}`).join(', ')}).`,
    );
  }
}

export async function installFresh(client, migrations, { wipe }) {
  let started = false;
  let phase = 'starting the transaction';
  try {
    await client.query('BEGIN');
    started = true;
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '20min'");
    if (wipe) {
      phase = 'wiping testdb';
      await client.query(WIPE_SQL);
    }
    phase = 'checking that the database is empty';
    await assertEmpty(client);
    await client.query(HISTORY_SQL);
    for (const migration of migrations) {
      phase = `applying ${migration.file}`;
      await client.query(migration.sql);
      // The CLI only compares versions; the whole file is kept as one statement for reference.
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, [migration.sql]],
      );
    }
    phase = 'committing';
    const result = await client.query('COMMIT');
    if (result.command !== 'COMMIT') {
      throw new FreshInstallError('The database did not confirm COMMIT.');
    }
  } catch (error) {
    if (phase === 'committing') {
      throw new FreshInstallError(
        'The commit outcome is unknown. Run npm run db:list before retrying.',
      );
    }
    const reason =
      error instanceof FreshInstallError
        ? error.message
        : `The install failed while ${phase}${databaseErrorCode(error)}.`;
    if (!started) {
      throw new FreshInstallError(`${reason} Nothing was changed.`);
    }
    try {
      const result = await client.query('ROLLBACK');
      if (result.command !== 'ROLLBACK') {
        throw new Error('Rollback was not confirmed.');
      }
    } catch {
      throw new FreshInstallError(
        `${reason} No COMMIT was sent, but rollback could not be confirmed; inspect the database before retrying.`,
      );
    }
    throw new FreshInstallError(
      `${reason} The transaction was rolled back; nothing was changed.`,
    );
  }
}

export async function runFreshInstall(args, getDatabaseUrl) {
  const { wipe } = parseFreshInstallArgs(args);
  const value = getDatabaseUrl();
  const target = wipe ? testdbSessionUrl(value) : new URL(value);
  const migrations = readMigrations(join(ROOT, 'supabase', 'migrations'));
  const pool = new Pool(
    databasePoolOptions(target, process.env.SUPABASE_DB_CA_CERT),
  );
  try {
    let client;
    try {
      client = await pool.connect();
    } catch (error) {
      throw new FreshInstallError(
        `Could not connect to the database${databaseErrorCode(error)}. Nothing was changed.`,
      );
    }
    try {
      await installFresh(client, migrations, { wipe });
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  console.log(
    `${wipe ? 'Wiped testdb and installed' : 'Installed'} ${migrations.length} migrations in one transaction.`,
  );
}
