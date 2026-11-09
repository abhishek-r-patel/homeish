// Verify the service-role import guard accepts the boundary and rejects leaks.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(
  new URL('../../scripts/check-privileged-imports.mjs', import.meta.url),
);
let directory = '';

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'homeish-privileged-'));
  mkdirSync(join(directory, 'src', 'core', 'privileged'), { recursive: true });
  mkdirSync(join(directory, 'src', 'core', 'config'), { recursive: true });
  writeFileSync(
    join(directory, 'src', 'core', 'config', 'env-schema.ts'),
    "const key = 'SUPABASE_SERVICE_ROLE_KEY';",
  );
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function run() {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: directory,
    encoding: 'utf8',
  });
}

describe('check-privileged-imports', () => {
  it('allows the service-role client inside the privileged folder', () => {
    writeFileSync(
      join(directory, 'src', 'core', 'privileged', 'client.ts'),
      "export const key = 'SUPABASE_SERVICE_ROLE_KEY';",
    );
    expect(run().status).toBe(0);
  });

  it('rejects direct service-role use outside the privileged folder', () => {
    writeFileSync(
      join(directory, 'src', 'feature.ts'),
      "import { privilegedClient } from './core/privileged/server-client';",
    );
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('feature.ts');
  });

  it('rejects a service key used outside the privileged folder', () => {
    writeFileSync(
      join(directory, 'src', 'feature.ts'),
      'createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);',
    );
    expect(run().status).toBe(1);
  });
});
