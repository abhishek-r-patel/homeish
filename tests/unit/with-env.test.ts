// Verify named environment profiles load completely and fail closed when incomplete.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const script = fileURLToPath(
  new URL('../../scripts/with-env.mjs', import.meta.url),
);
let directory = '';

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'homeish-env-'));
  writeFileSync(join(directory, '.env.example'), 'ALPHA=x\nBETA=\n');
  writeFileSync(
    join(directory, 'print.mjs'),
    'console.log(JSON.stringify({ alpha: process.env.ALPHA, beta: process.env.BETA }));',
  );
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, ALPHA: 'from-parent', BETA: 'from-parent' },
  });
}

it('loads the named profile over existing values and runs the command', () => {
  writeFileSync(
    join(directory, '.env.testdb.local'),
    'ALPHA=from-profile\nBETA=\n',
  );
  const result = run('testdb', 'node', 'print.mjs');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(
    'Using environment profile: .env.testdb.local',
  );
  expect(result.stdout).toContain('{"alpha":"from-profile","beta":""}');
});

it('passes the command exit code through', () => {
  writeFileSync(join(directory, '.env.testdb.local'), 'ALPHA=a\nBETA=b\n');
  expect(run('testdb', 'node', '-e', 'process.exit(3)').status).toBe(3);
});

it('passes arguments with spaces and shell characters unchanged', () => {
  writeFileSync(join(directory, '.env.testdb.local'), 'ALPHA=a\nBETA=b\n');
  const argument = "it's (a) test & more";
  const result = run(
    'testdb',
    'node',
    '-e',
    'console.log(JSON.stringify(process.argv[1]))',
    argument,
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(JSON.stringify(argument));
});

it('fails when the profile file is missing', () => {
  const result = run('demo', 'node', 'print.mjs');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('.env.demo.local was not found');
});

it('fails and names variables missing from the profile without printing values', () => {
  writeFileSync(join(directory, '.env.testdb.local'), 'ALPHA=secret-value\n');
  const result = run('testdb', 'node', 'print.mjs');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('missing: BETA');
  expect(result.stderr + result.stdout).not.toContain('secret-value');
});

it.each(['', '../outside', 'Test', 'a.b'])(
  'rejects unsafe or empty profile name %j',
  (name) => {
    expect(run(name, 'node', 'print.mjs').status).toBe(1);
  },
);

it('refuses the live profile even when its file exists', () => {
  writeFileSync(join(directory, '.env.live.local'), 'ALPHA=a\nBETA=b\n');
  const result = run('live', 'node', 'print.mjs');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('live profile cannot be used');
  expect(result.stdout).not.toContain('"alpha"');
});

it('rejects a missing command', () => {
  writeFileSync(join(directory, '.env.testdb.local'), 'ALPHA=a\nBETA=b\n');
  expect(run('testdb').status).toBe(1);
});
