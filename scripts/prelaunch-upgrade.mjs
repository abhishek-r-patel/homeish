// Guard the one-time testdb upgrade and keep migration history in the same transaction.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { databasePoolOptions } from './integrity-check.mjs';

export const PRELAUNCH_BASELINE = '20261123140000';
export const PRELAUNCH_LAST_MIGRATION = '20261124230000';
export const PRELAUNCH_METADATA_ENV = 'HOMEISH_PRELAUNCH_METADATA_PATH';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TESTDB_REF = 'oqyagsabodaueghtrocv';
const EXPECTED_CLI_VERSION = '3.2.0';
const EXPECTED_FILES_HASH =
  'b4916a013fd851ee6c9df01a07708cc0f316d12d4b5f664356fca1d6b10ac055';
const EXPECTED_METADATA_HASH =
  '228cfe4843f022a08bb206d718ceefd2e8716b1eb409e611d1d54f9891c859d4';
const APPLY_FLAGS = [
  '--apply-testdb',
  '--confirm-clients-paused',
  '--confirm-backup-verified',
  '--confirm-schema-verified',
];
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

export class PrelaunchUpgradeError extends Error {}

function isApplyRequest(args) {
  if (args.length === 0) return false;
  if (
    args.length !== APPLY_FLAGS.length ||
    new Set(args).size !== APPLY_FLAGS.length ||
    !APPLY_FLAGS.every((flag) => args.includes(flag))
  ) {
    throw new PrelaunchUpgradeError(
      'A testdb apply needs --apply-testdb and all three safety confirmations: ' +
        '--confirm-clients-paused --confirm-backup-verified --confirm-schema-verified.',
    );
  }
  return true;
}

export function testdbSessionUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PrelaunchUpgradeError('Invalid testdb session pooler address.');
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
    throw new PrelaunchUpgradeError(
      'Refusing to apply: the address is not the expected testdb session pooler.',
    );
  }
  return url;
}

function validatePrelaunchBatch(migrations) {
  if (
    !Array.isArray(migrations) ||
    migrations.length !== 114 ||
    migrations.some(
      (migration) =>
        !migration ||
        typeof migration.file !== 'string' ||
        !/^\d{14}_[a-z0-9_]+\.sql$/.test(migration.file) ||
        migration.version !== migration.file.slice(0, 14) ||
        migration.name !== migration.file.slice(15, -4) ||
        typeof migration.sql !== 'string',
    )
  ) {
    throw new PrelaunchUpgradeError(
      'Migration files differ from the tested pre-launch batch.',
    );
  }

  const hash = createHash('sha256');
  for (const { file, sql } of migrations) {
    hash.update(`${file}\0`).update(sql).update('\0');
  }
  if (
    hash.digest('hex') !== EXPECTED_FILES_HASH ||
    migrations.at(-1)?.version !== PRELAUNCH_LAST_MIGRATION ||
    migrations.filter(({ version }) => version > PRELAUNCH_BASELINE).length !==
      14
  ) {
    throw new PrelaunchUpgradeError(
      'Migration files differ from the tested pre-launch batch.',
    );
  }
}

export function readPrelaunchBatch(directory) {
  let migrations;
  try {
    const files = readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    migrations = files.map((file) => ({
      file,
      version: file.slice(0, 14),
      name: file.slice(15, -4),
      sql: readFileSync(join(directory, file), 'utf8'),
    }));
  } catch (error) {
    throw new PrelaunchUpgradeError(
      `Could not read the migration files${databaseErrorCode(error)}.`,
    );
  }
  validatePrelaunchBatch(migrations);
  return migrations;
}

export function validatePrelaunchRecords(migrations, records) {
  const pending = migrations.filter(
    ({ version }) => version > PRELAUNCH_BASELINE,
  );
  if (
    !Array.isArray(records) ||
    records.length !== pending.length ||
    records.some(
      (record, index) =>
        !record ||
        typeof record !== 'object' ||
        record.version !== pending[index].version ||
        record.name !== pending[index].name ||
        !Array.isArray(record.statements) ||
        record.statements.some((statement) => typeof statement !== 'string'),
    )
  ) {
    throw new PrelaunchUpgradeError(
      'Supabase migration metadata does not match the tested batch.',
    );
  }
  const hash = createHash('sha256')
    .update(
      JSON.stringify(
        records.map(({ version, name, statements }) => [
          version,
          name,
          statements,
        ]),
      ),
    )
    .digest('hex');
  if (hash !== EXPECTED_METADATA_HASH) {
    throw new PrelaunchUpgradeError(
      'Supabase migration metadata does not match the tested batch.',
    );
  }
}

function databaseErrorCode(error) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' && /^[A-Z0-9_]{3,40}$/.test(code)
    ? ` (${code})`
    : '';
}

export async function applyPrelaunchUpgrade(client, migrations, records) {
  validatePrelaunchBatch(migrations);
  validatePrelaunchRecords(migrations, records);
  const baseline = migrations
    .filter(({ version }) => version <= PRELAUNCH_BASELINE)
    .map(({ version }) => version);
  const pending = migrations.filter(
    ({ version }) => version > PRELAUNCH_BASELINE,
  );
  let started = false;
  let phase = 'starting the transaction';

  try {
    await client.query('BEGIN');
    started = true;
    await client.query("SET LOCAL lock_timeout = '4s'");
    phase = 'locking migration history';
    await client.query(
      'LOCK TABLE supabase_migrations.schema_migrations IN ACCESS EXCLUSIVE MODE',
    );
    phase = 'checking migration history';
    const history = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version',
    );
    if (
      JSON.stringify(history.rows.map(({ version }) => version)) !==
      JSON.stringify(baseline)
    ) {
      throw new PrelaunchUpgradeError(
        'The database migration history differs from the tested baseline.',
      );
    }

    for (const [index, migration] of pending.entries()) {
      phase = `applying ${migration.file}`;
      await client.query(migration.sql);
      const record = records[index];
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
         VALUES ($1, $2, $3)`,
        [record.version, record.name, record.statements],
      );
    }
    phase = 'committing';
    const result = await client.query('COMMIT');
    if (result.command !== 'COMMIT') {
      throw new PrelaunchUpgradeError('The database did not confirm COMMIT.');
    }
  } catch (error) {
    if (phase === 'committing') {
      throw new PrelaunchUpgradeError(
        'The commit outcome is unknown. Keep clients paused and inspect the database history before retrying.',
      );
    }
    const reason =
      error instanceof PrelaunchUpgradeError
        ? error.message
        : `The upgrade failed while ${phase}${databaseErrorCode(error)}.`;
    if (!started) {
      throw new PrelaunchUpgradeError(
        `${reason} No migrations were requested.`,
      );
    }
    try {
      const result = await client.query('ROLLBACK');
      if (result.command !== 'ROLLBACK') {
        throw new Error('Rollback was not confirmed.');
      }
    } catch {
      throw new PrelaunchUpgradeError(
        `${reason} No COMMIT was sent, but rollback could not be confirmed; inspect the database before retrying.`,
      );
    }
    throw new PrelaunchUpgradeError(
      `${reason} The transaction was rolled back.`,
    );
  }
}

function testEnvironment(metadataPath) {
  const allowed = new Set([
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'COMSPEC',
    'WINDIR',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'PG_BIN',
  ]);
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (allowed.has(key.toUpperCase()) && value !== undefined) env[key] = value;
  }
  env.CI = '1';
  env.NODE_ENV = 'test';
  env.SUPABASE_TELEMETRY_DISABLED = '1';
  env.DO_NOT_TRACK = '1';
  env[PRELAUNCH_METADATA_ENV] = metadataPath;
  return env;
}

async function localPreflight() {
  if (process.platform !== 'win32') {
    throw new PrelaunchUpgradeError(
      'The pre-launch preflight requires the Windows disposable database runner.',
    );
  }
  let directory;
  try {
    directory = mkdtempSync(join(tmpdir(), 'homeish-prelaunch-'));
  } catch (error) {
    throw new PrelaunchUpgradeError(
      `Could not create the disposable preflight directory${databaseErrorCode(error)}.`,
    );
  }
  const metadataPath = join(directory, 'metadata.json');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          join(ROOT, 'scripts', 'test-integration-local.ps1'),
          join('tests', 'integration', 'database-release-upgrade.test.ts'),
          '--maxWorkers=1',
        ],
        {
          cwd: ROOT,
          env: testEnvironment(metadataPath),
          stdio: 'inherit',
        },
      );
      child.once('error', () =>
        reject(
          new PrelaunchUpgradeError(
            'The disposable database preflight could not start.',
          ),
        ),
      );
      child.once('close', (code) => {
        if (code === 0) resolve();
        else
          reject(
            new PrelaunchUpgradeError(
              'The disposable database preflight failed. No hosted change was attempted.',
            ),
          );
      });
    });
    try {
      return JSON.parse(readFileSync(metadataPath, 'utf8'));
    } catch {
      throw new PrelaunchUpgradeError(
        'The disposable preflight did not produce valid migration metadata.',
      );
    }
  } finally {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch (error) {
      throw new PrelaunchUpgradeError(
        `Could not remove temporary directory ${basename(directory)}${databaseErrorCode(error)}. No hosted change was attempted.`,
      );
    }
  }
}

export async function runPrelaunchUpgrade(args, getDatabaseUrl) {
  const apply = isApplyRequest(args);
  const target = apply ? testdbSessionUrl(getDatabaseUrl()) : undefined;
  let cliVersion;
  try {
    cliVersion = JSON.parse(
      readFileSync(
        join(ROOT, 'node_modules', 'supabase', 'package.json'),
        'utf8',
      ),
    ).version;
  } catch {
    throw new PrelaunchUpgradeError(
      'Cannot read the installed Supabase CLI version.',
    );
  }
  if (cliVersion !== EXPECTED_CLI_VERSION) {
    throw new PrelaunchUpgradeError(
      'The installed Supabase CLI differs from the locally tested version.',
    );
  }

  const migrationDirectory = join(ROOT, 'supabase', 'migrations');
  readPrelaunchBatch(migrationDirectory);
  const records = await localPreflight();
  const migrations = readPrelaunchBatch(migrationDirectory);
  validatePrelaunchRecords(migrations, records);
  if (!apply) {
    console.log(
      'Local pre-launch checks passed; no hosted database was contacted.',
    );
    return;
  }

  const pool = new Pool(
    databasePoolOptions(target, process.env.SUPABASE_DB_CA_CERT),
  );
  try {
    let client;
    try {
      client = await pool.connect();
    } catch (error) {
      throw new PrelaunchUpgradeError(
        `Could not connect to testdb${databaseErrorCode(error)}. No migrations were requested.`,
      );
    }
    try {
      await applyPrelaunchUpgrade(client, migrations, records);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  console.log(
    'The testdb migration transaction committed. Keep clients paused until the matching app is deployed and verified.',
  );
}
