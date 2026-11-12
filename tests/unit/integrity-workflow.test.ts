// Keep scheduled integrity checks pinned to the non-production test database.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('database integrity workflow', () => {
  it('runs monthly checks only against the verified homeish-testdb project', () => {
    const workflow = readFileSync(
      new URL('../../.github/workflows/integrity-check.yml', import.meta.url),
      'utf8',
    );
    const job = workflow.slice(workflow.indexOf('testdb-integrity:'));

    expect(workflow).toContain("cron: '15 3 1 * *'");
    expect(job).toContain("github.ref == 'refs/heads/main'");
    expect(job).toContain(
      "github.event_name == 'workflow_dispatch' &&\n      github.ref == 'refs/heads/feature-build-1'",
    );
    expect(job).toContain('secrets.SUPABASE_TESTDB_URL');
    expect(job).toContain('oqyagsabodaueghtrocv');
    expect(job).toContain('npm run integrity:check');
    expect(job).toContain("NODE_USE_SYSTEM_CA: '1'");
    expect(job).not.toContain('secrets.SUPABASE_DB_URL');
    expect(job).not.toContain('upload-artifact');
  });
});
