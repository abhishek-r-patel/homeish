// Verify database helper scripts enforce migration naming and refuse unsafe targets.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const scriptPath = (name: string) =>
  fileURLToPath(new URL(`../../scripts/${name}`, import.meta.url));
let directory = '';

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'homeish-db-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function run(script: string, args: string[], env: Record<string, string> = {}) {
  const parentEnv: NodeJS.ProcessEnv = { ...process.env };
  delete parentEnv.SUPABASE_DB_URL;
  return spawnSync(process.execPath, [scriptPath(script), ...args], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...parentEnv, ...env },
  });
}

describe('check-migrations', () => {
  function withMigrations(...names: string[]) {
    const folder = join(directory, 'supabase', 'migrations');
    mkdirSync(folder, { recursive: true });
    for (const name of names) {
      writeFileSync(join(folder, name), '');
    }
  }

  it('accepts correctly named migrations and the folder placeholder', () => {
    withMigrations(
      '.gitkeep',
      '20261110093000_core_create_extensions.sql',
      '20261110093100_service_request_create_requests.sql',
    );
    const result = run('check-migrations.mjs', []);
    expect(result.status).toBe(0);
  });

  it.each([
    '20261110093000_create_extensions.sql',
    '20261110_core_create_extensions.sql',
    '20261110093000_core_Create.sql',
    '20261110093000_unknown_thing.sql',
    'notes.txt',
  ])('rejects badly named file %j', (name) => {
    withMigrations(name);
    const result = run('check-migrations.mjs', []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(name);
  });
});

describe('db', () => {
  const liveUrl =
    'postgresql://postgres.yhwadldjeyirkgbmoctb:secret-value@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
  const testdbUrl = (password: string) =>
    `postgresql://postgres.oqyagsabodaueghtrocv:${password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
  const localUrl =
    'postgresql://postgres:local-password@127.0.0.1:54322/postgres';

  it.each(['create_things', 'core', 'core_Bad', 'unknown_create_things'])(
    'rejects migration label %j before calling the CLI',
    (label) => {
      const result = run('db.mjs', ['new', label]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('<module>_<short_description>');
    },
  );

  it.each(['list', 'test', 'push', 'types'])(
    'refuses %s against homeish-live without printing the address',
    (action) => {
      const result = run('db.mjs', [action], { SUPABASE_DB_URL: liveUrl });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('homeish-live');
      expect(result.stderr + result.stdout).not.toContain('secret-value');
    },
  );

  it('refuses when no database address is loaded', () => {
    const result = run('db.mjs', ['list']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('SUPABASE_DB_URL');
  });

  it('refuses when the password placeholder is still present', () => {
    const result = run('db.mjs', ['push'], {
      SUPABASE_DB_URL: testdbUrl('__SET_DB_PASSWORD__'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('set-db-password.ps1');
  });

  it('refuses database tests when the password placeholder is still present', () => {
    const result = run('db.mjs', ['test'], {
      SUPABASE_DB_URL: testdbUrl('__SET_DB_PASSWORD__'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('set-db-password.ps1');
  });

  it('rejects unexpected database test arguments', () => {
    const result = run('db.mjs', ['test', '--yes']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('npm run db:test');
  });

  it('requires a database address for local database tests', () => {
    const result = run('db.mjs', ['test-local']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('SUPABASE_DB_URL');
  });

  it('refuses remote addresses for local database tests', () => {
    const result = run('db.mjs', ['test-local'], {
      SUPABASE_DB_URL: testdbUrl('secret-value'),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('port 54322');
    expect(result.stderr).not.toContain('secret-value');
  });

  it('accepts only local Supabase addresses for local database tests', () => {
    const result = run('db.mjs', ['test-local'], {
      SUPABASE_DB_URL: localUrl,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No database test files found');
  });

  it('rejects an unknown action', () => {
    expect(run('db.mjs', ['reset']).status).toBe(1);
  });
});
