// Run Supabase CLI database commands against the loaded profile's database (never a local stack or live).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

// Read without a separate existence check to avoid a check-then-use race (CodeQL js/file-system-race).
function readTextIfPresent(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
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
  const current = readTextIfPresent(TYPES_FILE);
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
      'Usage: node scripts/db.mjs <new|list|push|types> [options]\n' +
        'Database commands run through a profile, e.g. npm run db:push.',
    );
}
