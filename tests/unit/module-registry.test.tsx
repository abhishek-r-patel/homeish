// Verify the module registry, settings hooks and disabled-module experience.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getModuleDefinition,
  getModuleNavigation,
  getRoleNavigation,
  MODULE_KEYS,
  MODULE_REGISTRY,
  parseModuleSettings,
} from '../../src/core/modules';
import { ModuleDisabledPage } from '../../src/core/modules/module-disabled-page';
import { hasPermission } from '../../src/core/permissions';

describe('module registry', () => {
  it('registers every supported module with core as mandatory', () => {
    expect(Object.keys(MODULE_REGISTRY).sort()).toEqual(
      [...MODULE_KEYS].sort(),
    );
    expect(MODULE_REGISTRY.core.core).toBe(true);
    expect(
      MODULE_KEYS.filter((moduleKey) => moduleKey !== 'core').every(
        (moduleKey) => !MODULE_REGISTRY[moduleKey].core,
      ),
    ).toBe(true);
  });

  it('keeps permission and navigation declarations scoped to each module', () => {
    expect(hasPermission(['admin'], 'core', 'membership:manage')).toBe(true);
    expect(hasPermission(['admin'], 'visitor', 'visitor:list')).toBe(true);
    expect(getModuleNavigation('visitor', 'guard')).toEqual([
      {
        href: '/guard/visitors',
        label: 'Visitors',
        permission: 'visitor:list',
      },
    ]);
    expect(getRoleNavigation(['admin'], []).map(({ href }) => href)).toEqual([
      '/admin',
      '/admin/structure',
      '/admin/members',
      '/admin/settings',
      '/admin/guards',
      '/admin/jobs',
    ]);
    expect(hasPermission(['admin'], 'core', 'membership:read')).toBe(true);
    expect(hasPermission(['committee'], 'core', 'membership:read')).toBe(true);
    expect(hasPermission(['resident'], 'core', 'membership:read')).toBe(false);
    expect(hasPermission(['admin'], 'core', 'membership:manage')).toBe(true);
    expect(hasPermission(['committee'], 'core', 'membership:manage')).toBe(
      false,
    );
    expect(hasPermission(['resident'], 'visitor', 'visitor:decide')).toBe(true);
    expect(hasPermission(['resident'], 'visitor', 'visitor:create')).toBe(
      false,
    );
    expect(
      hasPermission(['committee'], 'visitor', 'visitor:blacklist:manage'),
    ).toBe(false);
    expect(hasPermission(['guard'], 'core', 'guards:read')).toBe(true);
    expect(hasPermission(['committee'], 'core', 'guards:manage')).toBe(false);
    expect(hasPermission(['resident'], 'core', 'household:read')).toBe(true);
    expect(hasPermission(['admin'], 'core', 'household:manage')).toBe(false);
    expect(hasPermission(['admin'], 'core', 'structure:manage')).toBe(true);
    expect(hasPermission(['resident'], 'core', 'structure:manage')).toBe(false);
    expect(getModuleNavigation('billing', 'guard')).toEqual([]);
    expect(getModuleDefinition('billing').name).toBe(
      'Maintenance, Fines & Payments',
    );
  });

  it('builds ordered navigation from enabled modules and role permissions', () => {
    const permissionMaps = {
      visitor: {
        'visitor:list': ['resident'],
      },
      billing: {
        'bill:list': ['resident'],
      },
    } as const;
    const nav = getRoleNavigation(
      ['resident'],
      ['billing', 'visitor'],
      permissionMaps,
    );

    expect(nav.map(({ href }) => href)).toEqual([
      '/home',
      '/household',
      '/visitors',
      '/bills',
    ]);
    expect(
      getRoleNavigation(['resident'], ['visitor'], permissionMaps).map(
        ({ href }) => href,
      ),
    ).toEqual(['/home', '/household', '/visitors']);
  });

  it('validates settings through each module schema', () => {
    expect(parseModuleSettings('visitor', {})).toEqual({});
    expect(
      parseModuleSettings('visitor', {
        approval_timeout_minutes: 3,
        guard_override_allowed: false,
        overstay_hours: 12,
        phone_required: false,
        photo_required: true,
      }),
    ).toEqual({
      approval_timeout_minutes: 3,
      guard_override_allowed: false,
      overstay_hours: 12,
      phone_required: false,
      photo_required: true,
    });
    expect(() => parseModuleSettings('visitor', { unknown: true })).toThrow();
    expect(() =>
      parseModuleSettings('visitor', { approval_timeout_minutes: 0 }),
    ).toThrow();
  });

  it('renders a module-disabled page without implying its data was deleted', () => {
    const markup = renderToStaticMarkup(
      <ModuleDisabledPage moduleKey="visitor" returnHref="/home" />,
    );

    expect(markup).toContain('Visitor Management is not available');
    expect(markup).toContain('Existing information has not been removed.');
    expect(markup).toContain('href="/home"');
  });
});
