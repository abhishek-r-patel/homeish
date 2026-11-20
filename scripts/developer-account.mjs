// Create or delete a platform developer login (Supabase login + developer mark): preview by default, write with --apply.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { describeTarget } from './create-society.mjs';
import { databasePoolOptions } from './integrity-check.mjs';

const ACTIONS = ['create', 'delete'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_PATTERN = /^[a-z0-9-]+$/;
// Set by this script when it re-runs itself through with-env.mjs, so the profile is loaded once.
const PROFILE_MARKER = 'HOMEISH_DEVELOPER_SCRIPT_PROFILE';

export const USAGE = `Usage: npm run developer:create -- --db <profile> --email <email> [--apply]
       npm run developer:delete -- --db <profile> --email <email> [--apply]

create: creates the Supabase login (email confirmed) if it does not exist,
        asking for its password with hidden typing, then marks it as a
        Homeish developer. An existing login is only marked.
delete: removes the developer mark and deletes the login. If the app has
        records linked to the login (for example audit history), only the
        developer mark is removed and the login is kept.

Required:
  --db <profile>       Environment profile to use, e.g. testdb or demo (.env.<profile>.local)
  --email <email>      Email of the developer login
Optional:
  --ca-cert <file>     Supabase root certificate file (default: SUPABASE_DB_CA_CERT)
Mode:
  --dry-run            Check and print what would change (default)
  --apply              Make the change (create needs an interactive terminal)

Live is refused: it is never used from a laptop (AD-14).`;

const OPTIONS = {
  db: { type: 'string' },
  email: { type: 'string' },
  'ca-cert': { type: 'string' },
  'dry-run': { type: 'boolean', default: false },
  apply: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
};

export function parseDeveloperArgs(argv) {
  const [action, ...rest] = argv;
  if (!ACTIONS.includes(action)) {
    return {
      help: false,
      errors: ['The first argument must be create or delete.'],
      input: null,
    };
  }
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: OPTIONS, strict: true });
  } catch (error) {
    return { help: false, errors: [error.message], input: null };
  }
  const values = parsed.values;
  if (values.help) return { help: true, errors: [], input: null };

  const errors = [];
  const input = {
    action,
    db: (values.db ?? '').trim(),
    email: (values.email ?? '').trim().toLowerCase(),
    caCertFile: values['ca-cert']?.trim() || null,
    apply: values.apply,
  };
  if (values.apply && values['dry-run']) {
    errors.push('Choose either --dry-run or --apply, not both.');
  }
  if (!PROFILE_PATTERN.test(input.db)) {
    errors.push('--db must be a profile name such as testdb or demo.');
  } else if (input.db === 'live') {
    errors.push('--db live is refused: live is never used from a laptop.');
  }
  if (!EMAIL_PATTERN.test(input.email) || input.email.length > 254) {
    errors.push('--email must be a valid email address.');
  }
  return { help: false, errors, input: errors.length ? null : input };
}

// Finds the one login with this email and its readiness, inside the caller's transaction.
async function findLogin(client, email) {
  const { rows } = await client.query(
    `select u.id,
            u.email_confirmed_at is not null as confirmed,
            p.status as profile_status,
            exists (select 1 from public.developers d where d.user_id = u.id)
              as is_developer
       from auth.users u
       left join public.profiles p on p.id = u.id
      where lower(u.email) = lower($1)`,
    [email],
  );
  if (rows.length === 0) return { status: 'not-found' };
  if (rows.length > 1) return { status: 'ambiguous' };
  return { login: rows[0] };
}

const WRITES = new Set([
  'added',
  'removed',
  'access-removed',
  'leftover-removed',
]);

async function inTransaction(client, apply, fn) {
  await client.query('BEGIN');
  try {
    if (!apply) await client.query('SET TRANSACTION READ ONLY');
    const status = await fn();
    await client.query(WRITES.has(status) ? 'COMMIT' : 'ROLLBACK');
    return status;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

// Checks the login and, with apply, adds it to developers in one transaction.
export function markDeveloper(client, email, { apply }) {
  return inTransaction(client, apply, async () => {
    const { status, login } = await findLogin(client, email);
    if (status) return status;
    if (!login.confirmed) return 'unconfirmed';
    if (login.profile_status === null) return 'no-profile';
    if (login.profile_status !== 'active') return 'inactive-profile';
    if (login.is_developer) return 'already-developer';
    if (!apply) return 'would-add';
    await client.query(
      'insert into public.developers (user_id) values ($1) on conflict do nothing',
      [login.id],
    );
    return 'added';
  });
}

// Creates the login through `createLogin` when it is missing, then marks it.
export async function createDeveloper(client, email, { apply, createLogin }) {
  const status = await markDeveloper(client, email, { apply });
  if (status !== 'not-found') return status;
  if (!apply) return 'would-create';
  await createLogin(email);
  const marked = await markDeveloper(client, email, { apply: true });
  return marked === 'added' ? 'created' : marked;
}

// Profiles have no foreign key to auth.users (anonymized tombstones outlive logins),
// so a login deleted in the dashboard can leave its profile behind.
async function deleteProfileIfUnlinked(client, userId) {
  await client.query('SAVEPOINT profile_delete');
  try {
    await client.query('delete from public.profiles where id = $1', [userId]);
    await client.query('RELEASE SAVEPOINT profile_delete');
    return true;
  } catch (error) {
    if (error.code !== '23503') throw error;
    await client.query('ROLLBACK TO SAVEPOINT profile_delete');
    return false;
  }
}

// Removes the developer mark, profile and login in one transaction; keeps a login with linked records.
export function deleteDeveloper(client, email, { apply }) {
  return inTransaction(client, apply, async () => {
    const { status, login } = await findLogin(client, email);
    if (status === 'ambiguous') return status;
    if (status === 'not-found') {
      const { rows } = await client.query(
        `select p.id from public.profiles p
          where lower(p.email) = lower($1) and p.status <> 'anonymized'
            and not exists (select 1 from auth.users u where u.id = p.id)`,
        [email],
      );
      if (rows.length !== 1) return 'not-found';
      if (!apply) return 'would-remove-leftover';
      await client.query('delete from public.developers where user_id = $1', [
        rows[0].id,
      ]);
      return (await deleteProfileIfUnlinked(client, rows[0].id))
        ? 'leftover-removed'
        : 'access-removed';
    }
    if (!apply) return 'would-remove';
    await client.query('delete from public.developers where user_id = $1', [
      login.id,
    ]);
    if (!(await deleteProfileIfUnlinked(client, login.id))) {
      return 'access-removed';
    }
    await client.query('delete from auth.users where id = $1', [login.id]);
    return 'removed';
  });
}

export const OUTCOMES = {
  'not-found': {
    ok: false,
    message: 'No login has this email. Nothing was changed.',
  },
  ambiguous: {
    ok: false,
    message: 'More than one login matches this email. Nothing was changed.',
  },
  unconfirmed: {
    ok: false,
    message:
      'The login email is not confirmed. Delete it with developer:delete and create it again.',
  },
  'no-profile': {
    ok: false,
    message:
      'The login has no Homeish profile yet. Check the database is fully installed, then run again.',
  },
  'inactive-profile': {
    ok: false,
    message:
      'The login profile is disabled or anonymized. Nothing was changed.',
  },
  'already-developer': {
    ok: true,
    message: 'This login is already a developer. Nothing to change.',
  },
  'would-add': {
    ok: true,
    message:
      'Ready: this existing login would be made a developer. Run again with --apply.',
  },
  'would-create': {
    ok: true,
    message:
      'Ready: a new login would be created (you will be asked for its password) and made a developer. Run again with --apply.',
  },
  added: {
    ok: true,
    message:
      'Done: this existing login is now a developer. Set up the authenticator app at first sign-in.',
  },
  created: {
    ok: true,
    message:
      'Done: the login was created and is now a developer. Set up the authenticator app at first sign-in.',
  },
  'would-remove': {
    ok: true,
    message:
      'Ready: developer access and the login would be deleted (the login is kept if records are linked to it). Run again with --apply.',
  },
  'would-remove-leftover': {
    ok: true,
    message:
      'Ready: the login is already gone; its leftover profile and developer mark would be removed. Run again with --apply.',
  },
  removed: {
    ok: true,
    message: 'Done: developer access and the login were deleted.',
  },
  'leftover-removed': {
    ok: true,
    message: 'Done: the leftover profile and developer mark were removed.',
  },
  'access-removed': {
    ok: true,
    message:
      'Done: developer access was removed. The login was kept because the app has records linked to it.',
  },
};

// Reads one line without echoing it; refuses when there is no interactive terminal.
function readHidden(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error(
        'Creating a login needs an interactive terminal for the password.',
      ),
    );
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolveLine, rejectLine) => {
    let value = '';
    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      if (error) rejectLine(error);
      else resolveLine(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    stdin.on('data', onData);
  });
}

function loginCreator(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return async (email) => {
    if (!url || !serviceKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to create a login.',
      );
    }
    const password = await readHidden('New login password: ');
    if ((await readHidden('Type it again: ')) !== password) {
      throw new Error('The passwords did not match. Nothing was changed.');
    }
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`Supabase refused to create the login: ${error.message}`);
    }
  };
}

function rerunWithProfile(db, argv) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn(
    process.execPath,
    [
      resolve(root, 'scripts', 'with-env.mjs'),
      db,
      'node',
      // Trust the operating system's certificates too, so Supabase's Auth API works behind TLS-inspecting networks.
      '--use-system-ca',
      resolve(root, 'scripts', 'developer-account.mjs'),
      ...argv,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, [PROFILE_MARKER]: db },
    },
  );
  child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
}

async function main(argv) {
  const { help, errors, input } = parseDeveloperArgs(argv);
  if (help) {
    console.log(USAGE);
    return;
  }
  if (!input) {
    console.error(`${errors.join('\n')}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if (process.env[PROFILE_MARKER] !== input.db) {
    rerunWithProfile(input.db, argv);
    return;
  }

  if (describeTarget(process.env).isLive) {
    throw new Error(
      'This profile points at live, which is never used from a laptop.',
    );
  }
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!databaseUrl) {
    throw new Error(`SUPABASE_DB_URL is not set in .env.${input.db}.local.`);
  }
  const rootCertificate = input.caCertFile
    ? readFileSync(input.caCertFile, 'utf8')
    : process.env.SUPABASE_DB_CA_CERT;

  const pool = new Pool(
    databasePoolOptions(new URL(databaseUrl), rootCertificate),
  );
  try {
    const client = await pool.connect();
    try {
      await client.query("SET statement_timeout = '30s'");
      console.log(
        `${input.apply ? 'Applying' : 'Checking (dry run)'} developer ${input.action} on profile "${input.db}" for ${input.email}`,
      );
      const status =
        input.action === 'create'
          ? await createDeveloper(client, input.email, {
              apply: input.apply,
              createLogin: loginCreator(process.env),
            })
          : await deleteDeveloper(client, input.email, input);
      const outcome = OUTCOMES[status];
      console.log(outcome.message);
      if (!outcome.ok) process.exitCode = 1;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Failed: ${error.message}`);
    process.exitCode = 1;
  });
}
