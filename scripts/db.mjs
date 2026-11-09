// Run Supabase CLI database commands against the loaded profile's database (never a local stack or live).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidMigrationLabel, NAMING_HELP } from './migration-rules.mjs';

const LIVE_PROJECT_REF = 'yhwadldjeyirkgbmoctb';
const TYPES_FILE = 'src/core/db/database.types.ts';
const TYPES_HEADER =
  '// Generated database types from `npm run db:types`; do not edit by hand.\n';
const CLI = 'node_modules/supabase/dist/supabase.js';

const [action, ...rest] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function redact(text) {
  return text.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g, '<database-url>');
}

function targetDatabaseUrl() {
  const url = process.env.SUPABASE_DB_URL ?? '';
  const match = /^postgres(?:ql)?:\/\/postgres\.([a-z0-9]+):([^@]*)@/.exec(url);
  if (!match) {
    fail(
      'SUPABASE_DB_URL is missing or not a Supabase pooler address. ' +
        'Run through a profile, e.g. npm run db:list.',
    );
  }
  if (match[1] === LIVE_PROJECT_REF) {
    fail('Refusing to run against homeish-live from a laptop (AD-14).');
  }
  if (match[2] === '' || match[2] === '__SET_DB_PASSWORD__') {
    fail(
      'The database password is not set. Run scripts/set-db-password.ps1 <profile>.',
    );
  }
  return url;
}

function databaseConnection() {
  return psqlConnection(new URL(targetDatabaseUrl()), 'require');
}

function localDatabaseConnection() {
  const value = process.env.SUPABASE_DB_URL ?? '';
  if (!URL.canParse(value)) {
    fail('SUPABASE_DB_URL must point to the local Supabase database.');
  }
  const url = new URL(value);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.port !== '54322'
  ) {
    fail(
      'Local database tests require the local Supabase database at port 54322.',
    );
  }
  return psqlConnection(url, 'disable');
}

function psqlConnection(url, sslMode) {
  const password = decodeURIComponent(url.password);
  const inheritedNames = [
    'PATH',
    'PATHEXT',
    'SystemRoot',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
  ];
  const env = {
    ...Object.fromEntries(
      inheritedNames.flatMap((name) =>
        process.env[name] === undefined ? [] : [[name, process.env[name]]],
      ),
    ),
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: password,
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: sslMode,
  };
  delete env.SUPABASE_DB_URL;
  return { env, host: url.hostname, password };
}

function findSqlTests(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? findSqlTests(path) : [path];
    })
    .filter((path) => path.endsWith('.test.sql'))
    .sort();
}

async function runSqlTest(file, connection) {
  const executable = process.env.PSQL_PATH || 'psql';
  const child = spawn(
    executable,
    ['--no-psqlrc', '--quiet', '--set=ON_ERROR_STOP=1'],
    {
      stdio: ['pipe', 'ignore', 'pipe'],
      env: connection.env,
    },
  );
  let stderr = '';
  let launchError;
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('error', (error) => {
    launchError = error;
  });
  child.stdin.end(`BEGIN;\n${readFileSync(file, 'utf8')}\nROLLBACK;\n`);
  const code = await new Promise((resolve) => {
    child.on('close', resolve);
  });
  if (launchError) {
    if (launchError.code === 'ENOENT') {
      fail(
        'psql was not found. Add PostgreSQL bin to PATH or set PSQL_PATH to psql.exe.',
      );
    }
    fail(`Could not start psql: ${launchError.message}`);
  }
  if (code !== 0) {
    const safeError = redact(stderr)
      .split(connection.host)
      .join('<database-host>')
      .split(connection.password)
      .join('<database-password>');
    fail(`Database test failed: ${file}\n${safeError.trim()}`);
  }
  console.log(`PASS ${file}`);
}

async function runDatabaseTests(connection, target) {
  const files = findSqlTests('supabase/tests');
  if (files.length === 0) {
    fail('No database test files found in supabase/tests.');
  }
  console.log(`Running ${files.length} database test(s) against ${target}.`);
  for (const file of files) {
    await runSqlTest(file, connection);
  }
}

// Runs the CLI with the OS certificate store trusted (needed behind TLS-inspecting networks).
function runCli(args, { capture = false } = {}) {
  if (!existsSync(CLI)) {
    fail('Supabase CLI not found. Run npm install first.');
  }
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, NODE_USE_SYSTEM_CA: '1' },
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      if (capture) {
        stdout += chunk;
      } else {
        process.stdout.write(redact(chunk.toString()));
      }
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(redact(chunk.toString()));
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout }));
  });
}

async function generateTypes(check) {
  const remote = `--remote=${targetDatabaseUrl()}`;
  const result = await runCli(
    ['gen', 'types', '--lang', 'typescript', '--schema', 'public', remote],
    { capture: true },
  );
  if (result.code !== 0) {
    process.exit(result.code);
  }
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(TYPES_FILE)) ?? {};
  const formatted = await prettier.format(TYPES_HEADER + result.stdout, {
    ...options,
    filepath: TYPES_FILE,
  });
  const current = existsSync(TYPES_FILE)
    ? readFileSync(TYPES_FILE, 'utf8')
    : '';
  if (check) {
    if (current !== formatted) {
      fail(`${TYPES_FILE} is out of date. Run npm run db:types.`);
    }
    console.log(`${TYPES_FILE} matches the database.`);
    return;
  }
  writeFileSync(TYPES_FILE, formatted);
  console.log(`Wrote ${TYPES_FILE}.`);
}

switch (action) {
  case 'new': {
    const [label] = rest;
    if (rest.length !== 1 || !isValidMigrationLabel(label)) {
      fail(
        `Usage: npm run db:new -- <module>_<short_description>\n${NAMING_HELP}`,
      );
    }
    process.exit((await runCli(['migration', 'new', label])).code);
    break;
  }
  case 'list':
    process.exit(
      (await runCli(['migration', 'list', `--remote=${targetDatabaseUrl()}`]))
        .code,
    );
    break;
  case 'test': {
    if (rest.length > 0) {
      fail('Usage: npm run db:test');
    }
    await runDatabaseTests(databaseConnection(), 'testdb');
    break;
  }
  case 'test-local': {
    if (rest.length > 0) {
      fail('Usage: npm run db:test:local');
    }
    await runDatabaseTests(localDatabaseConnection(), 'local Supabase');
    break;
  }
  case 'push':
    process.exit(
      (await runCli(['db', 'push', `--remote=${targetDatabaseUrl()}`, ...rest]))
        .code,
    );
    break;
  case 'types':
    await generateTypes(rest.includes('--check'));
    break;
  default:
    fail(
      'Usage: node scripts/db.mjs <new|list|test|test-local|push|types> [options]\n' +
        'Database commands run through a profile, e.g. npm run db:push.',
    );
}
