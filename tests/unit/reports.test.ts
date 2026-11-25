// Verify the P60 report catalogue honours role permissions and enabled modules.
import { describe, expect, it } from 'vitest';
import { getAllowedReports } from '../../src/core/home/reports';
import type { ModuleKey } from '../../src/core/modules';

describe('reports hub', () => {
  it('shows only reports the role may open in enabled modules', () => {
    const enabled = new Set<ModuleKey>([
      'core',
      'billing',
      'expense',
      'service_request',
    ]);
    const admin = getAllowedReports(['admin'], enabled).map(({ id }) => id);
    const committee = getAllowedReports(['committee'], enabled).map(
      ({ id }) => id,
    );

    expect(admin).toContain('billing-reports');
    expect(admin).toContain('dues-follow-up');
    expect(admin).toContain('expense-reports');
    expect(committee).toContain('billing-reports');
    expect(committee).not.toContain('dues-follow-up');
    expect(getAllowedReports(['admin'], new Set<ModuleKey>(['core']))).toEqual([
      expect.objectContaining({ id: 'analytics-export' }),
    ]);
  });
});
