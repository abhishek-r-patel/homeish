// Verify each Vercel project builds only its own release branch.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it.each([
  ['shared', 'main', 1],
  ['shared', 'beta', 0],
  ['beta', 'main', 0],
  ['beta', 'beta', 1],
  ['beta', 'feature/test', 0],
  ['invalid', 'main', 0],
  ['shared', '', 1],
])('gates %s project builds from %s', (deployment, branch, status) => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../scripts/vercel-ignore-build.mjs', import.meta.url),
      ),
    ],
    {
      env: {
        ...process.env,
        APP_DEPLOYMENT: deployment,
        VERCEL_GIT_COMMIT_REF: branch,
      },
    },
  );
  expect(result.status).toBe(status);
});
