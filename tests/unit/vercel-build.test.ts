// Verify each Vercel project builds only its own release branch.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('enables only release branch deployments with the project build gate', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
  );
  expect(config.git.deploymentEnabled).toEqual({
    main: true,
    beta: true,
    '*': false,
  });
  expect(config.ignoreCommand).toBe('node scripts/vercel-ignore-build.mjs');
  expect(config.crons).toEqual([
    { path: '/api/jobs/daily', schedule: '30 18 * * *' },
  ]);
});

it.each([
  ['shared', 'main', 1],
  ['shared', 'beta', 0],
  ['shared', 'feature/test', 0],
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
