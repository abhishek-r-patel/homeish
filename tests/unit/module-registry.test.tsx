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
    expect(hasPermission(['guard'], 'staff', 'staff:gate')).toBe(true);
    expect(hasPermission(['committee'], 'staff', 'staff:manage')).toBe(false);
    expect(hasPermission(['committee'], 'amc', 'amc:list')).toBe(true);
    expect(hasPermission(['committee'], 'amc', 'amc:manage')).toBe(false);
    expect(hasPermission(['resident'], 'amc', 'amc:list')).toBe(false);
    expect(hasPermission(['committee'], 'amenity', 'amenity:list')).toBe(true);
    expect(hasPermission(['committee'], 'amenity', 'amenity:book')).toBe(false);
    expect(hasPermission(['resident'], 'amenity', 'amenity:book')).toBe(true);
    expect(
      getRoleNavigation(['committee'], ['amc', 'amenity'])
        .filter(({ moduleKey }) => moduleKey !== 'core')
        .map(({ href }) => href),
    ).toEqual(['/admin/amc', '/admin/amenities']);
    expect(hasPermission(['committee'], 'housekeeping', 'stock:list')).toBe(
      true,
    );
    expect(hasPermission(['committee'], 'housekeeping', 'stock:manage')).toBe(
      false,
    );
    expect(getModuleNavigation('staff', 'guard')).toEqual([
      {
        href: '/guard/staff',
        label: 'Staff entry',
        permission: 'staff:gate',
      },
    ]);
    expect(hasPermission(['committee'], 'delivery', 'delivery:list')).toBe(
      true,
    );
    expect(getModuleNavigation('delivery', 'committee')).toEqual([
      {
        href: '/admin/deliveries',
        label: 'Deliveries',
        permission: 'delivery:list',
      },
    ]);
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
        'billing:bills:read': ['resident'],
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
    expect(parseModuleSettings('staff', {})).toEqual({});
    expect(
      parseModuleSettings('staff', { resident_approval_required: true }),
    ).toEqual({ resident_approval_required: true });
    expect(() =>
      parseModuleSettings('staff', { resident_approval_required: 'yes' }),
    ).toThrow();
    expect(getModuleDefinition('staff').defaultSettings).toEqual({
      resident_approval_required: true,
    });
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
    expect(
      parseModuleSettings('delivery', {
        response_timeout_minutes: 3,
        uncollected_days: 30,
        leave_at_gate_enabled: false,
      }),
    ).toEqual({
      response_timeout_minutes: 3,
      uncollected_days: 30,
      leave_at_gate_enabled: false,
    });
    expect(() =>
      parseModuleSettings('delivery', { uncollected_days: 0 }),
    ).toThrow();
    expect(() => parseModuleSettings('delivery', { unknown: true })).toThrow();
  });

  it('renders a module-disabled page without implying its data was deleted', () => {
    const markup = renderToStaticMarkup(
      <ModuleDisabledPage moduleKey="visitor" returnHref="/home" />,
    );

    expect(markup).toContain('Visitor Management is not available');
    expect(markup).toContain('Existing information has not been removed.');
    expect(markup).toContain('href="/home"');
  });

  it('exposes billing setup only to authorized roles and keeps its settings developer-managed', () => {
    expect(hasPermission(['admin'], 'billing', 'billing:charges:manage')).toBe(
      true,
    );
    expect(
      hasPermission(['committee'], 'billing', 'billing:charges:read'),
    ).toBe(true);
    expect(
      hasPermission(['committee'], 'billing', 'billing:charges:manage'),
    ).toBe(false);
    expect(hasPermission(['guard'], 'billing', 'billing:charges:read')).toBe(
      false,
    );
    expect(
      hasPermission(['resident'], 'billing', 'billing:payment_details:read'),
    ).toBe(true);
    expect(
      hasPermission(['resident'], 'billing', 'billing:payment_details:manage'),
    ).toBe(false);
    expect(
      getRoleNavigation(['admin'], ['billing']).some(
        ({ href }) => href === '/admin/billing',
      ),
    ).toBe(true);
    expect(
      getRoleNavigation(['guard'], ['billing']).some(
        ({ moduleKey }) => moduleKey === 'billing',
      ),
    ).toBe(false);
    expect(getModuleDefinition('billing').settingsAccess).toEqual({
      billing: 'developer',
      due_day_of_month: 'admin',
      rounding: 'admin',
    });
    expect(
      parseModuleSettings('billing', {
        late_fee: { type: 'percent', value: 2.5 },
        due_day_of_month: 'last_day',
        rounding: 'rupee',
      }),
    ).toEqual({
      late_fee: { type: 'percent', value: 2.5 },
      due_day_of_month: 'last_day',
      rounding: 'rupee',
    });
  });
});
