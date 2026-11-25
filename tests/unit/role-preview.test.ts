// Verify role preview uses the real navigation and permission registry.
import { describe, expect, it } from 'vitest';
import { buildRolePreview } from '../../src/core/home/role-preview';

describe('role preview', () => {
  it('uses the real module and permission registry', () => {
    const resident = buildRolePreview('resident', [
      'core',
      'visitor',
      'billing',
      'notice',
    ]);
    const guard = buildRolePreview('guard', ['core', 'visitor', 'delivery']);
    expect(resident.tabs).toContain('Visitors');
    expect(resident.tabs).toContain('Bills');
    expect(resident.actions).toContain('Pre-approve a guest');
    expect(guard.actions).toContain('Manage visitors');
    expect(guard.groups.flatMap((group) => group.items)).not.toContain(
      'Billing',
    );
  });
});
