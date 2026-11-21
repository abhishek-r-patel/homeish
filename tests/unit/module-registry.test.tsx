// Verify the module registry, settings hooks and disabled-module experience.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_METRICS } from '../../src/core/analytics/catalogue';
import {
  GETTING_STARTED_PATHS,
  HELP_ARTICLES,
} from '../../src/core/help/articles';
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
    expect(
      hasPermission(['committee'], 'billing', 'billing:charges:read'),
    ).toBe(true);
    expect(
      hasPermission(['committee'], 'billing', 'billing:monthly_report:export'),
    ).toBe(false);
    expect(
      hasPermission(['committee'], 'billing', 'billing:dues_follow_up:read'),
    ).toBe(false);
    expect(
      hasPermission(['admin'], 'billing', 'billing:dues_follow_up:read'),
    ).toBe(true);
    expect(hasPermission(['committee'], 'amenity', 'amenity:list')).toBe(true);
    expect(hasPermission(['committee'], 'amenity', 'amenity:book')).toBe(false);
    expect(hasPermission(['resident'], 'amenity', 'amenity:book')).toBe(true);
    expect(hasPermission(['admin'], 'directory', 'directory:manage')).toBe(
      true,
    );
    expect(hasPermission(['committee'], 'directory', 'directory:manage')).toBe(
      false,
    );
    expect(
      hasPermission(['guard'], 'directory', 'directory:lookup_vehicle'),
    ).toBe(true);
    expect(
      hasPermission(['resident'], 'directory', 'directory:lookup_vehicle'),
    ).toBe(false);
    expect(hasPermission(['committee'], 'expense', 'expense:list')).toBe(true);
    expect(hasPermission(['committee'], 'expense', 'expense:approve')).toBe(
      true,
    );
    expect(hasPermission(['committee'], 'expense', 'expense:manage')).toBe(
      false,
    );
    expect(hasPermission(['admin'], 'expense', 'expense:manage')).toBe(true);
    expect(hasPermission(['admin'], 'expense', 'expense:approve')).toBe(false);
    expect(hasPermission(['resident'], 'expense', 'expense:list')).toBe(false);
    expect(getRoleNavigation(['resident'], ['expense'])).not.toContainEqual(
      expect.objectContaining({ moduleKey: 'expense' }),
    );
    expect(
      getModuleNavigation('expense', 'committee').map(({ href }) => href),
    ).toEqual(['/admin/expenses']);
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
      '/admin/analytics',
      '/admin/communication',
      '/admin/structure',
      '/admin/members',
      '/admin/settings',
      '/admin/guards',
      '/admin/society-profile',
      '/admin/adoption',
      '/admin/jobs',
      '/admin/action-plans',
      '/admin/letters',
      '/admin/contact-log',
      '/help',
    ]);
    expect(
      getRoleNavigation(['committee'], []).map(({ href }) => href),
    ).toEqual([
      '/admin',
      '/admin/analytics',
      '/admin/communication',
      '/admin/structure',
      '/admin/guards',
      '/admin/society-profile',
      '/admin/adoption',
      '/admin/action-plans',
      '/admin/letters',
      '/admin/contact-log',
      '/help',
    ]);
    expect(hasPermission(['committee'], 'core', 'contact_log:manage')).toBe(
      false,
    );
    expect(hasPermission(['committee'], 'core', 'contact_log:read')).toBe(true);
    expect(hasPermission(['admin'], 'core', 'contact_log:manage')).toBe(true);
    expect(hasPermission(['admin'], 'core', 'action_plan:delete_task')).toBe(
      true,
    );
    expect(
      hasPermission(['committee'], 'core', 'action_plan:delete_task'),
    ).toBe(false);
    expect(hasPermission(['resident'], 'core', 'contact_log:manage')).toBe(
      false,
    );
    expect(hasPermission(['guard'], 'core', 'communication:read')).toBe(false);
    expect(hasPermission(['committee'], 'core', 'society_profile:manage')).toBe(
      false,
    );
    expect(hasPermission(['committee'], 'core', 'adoption:manage')).toBe(false);
    expect(hasPermission(['guard'], 'core', 'action_plan:manage')).toBe(false);
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
      '/action-plans',
      '/help',
      '/visitors',
      '/bills',
    ]);
    expect(
      getRoleNavigation(['resident'], ['visitor'], permissionMaps).map(
        ({ href }) => href,
      ),
    ).toEqual(['/home', '/household', '/action-plans', '/help', '/visitors']);
  });

  it('exposes enabled directory routes for each permitted role', () => {
    expect(
      getRoleNavigation(['resident'], ['directory'])
        .filter(({ moduleKey }) => moduleKey === 'directory')
        .map(({ href }) => href),
    ).toEqual(['/directory']);
    expect(
      getRoleNavigation(['resident'], []).some(
        ({ moduleKey }) => moduleKey === 'directory',
      ),
    ).toBe(false);
    expect(
      getModuleNavigation('directory', 'guard').map(({ href }) => href),
    ).toEqual(['/guard/directory']);
    expect(
      getModuleNavigation('directory', 'admin').map(({ href }) => href),
    ).toEqual(['/admin/directory']);
    expect(
      getModuleNavigation('directory', 'committee').map(({ href }) => href),
    ).toEqual(['/admin/directory']);
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

describe('in-app links', () => {
  const KNOWN_UNBUILT = new Set<string>();

  function appRoutes() {
    const appDir = join(__dirname, '../../src/app');
    const routes: RegExp[] = [];
    const walk = (dir: string, segments: string[]) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), [...segments, entry.name]);
        } else if (/^(page|route)\.tsx?$/.test(entry.name)) {
          const path = segments
            .filter((segment) => !/^\(.*\)$/.test(segment))
            .map((segment) =>
              /^\[.*\]$/.test(segment)
                ? '[^/]+'
                : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            )
            .join('/');
          routes.push(new RegExp(`^/${path}$`));
        }
      }
    };
    walk(appDir, []);
    return routes;
  }

  it('point menus, help and analytics tiles at pages that exist', () => {
    const hrefs = [
      ...Object.values(MODULE_REGISTRY).flatMap((definition) =>
        Object.values(definition.navigation).flatMap((items) =>
          (items ?? []).map((item) => item.href),
        ),
      ),
      ...HELP_ARTICLES.flatMap((article) =>
        article.links.map((link) => link.href),
      ),
      ...Object.values(GETTING_STARTED_PATHS).flatMap((steps) =>
        steps.flatMap((step) => step.links.map((link) => link.href)),
      ),
      ...ANALYTICS_METRICS.map((metric) => metric.href),
    ];
    const routes = appRoutes();
    const missing = [
      ...new Set(hrefs.map((href) => href.split(/[?#]/)[0] || '/')),
    ].filter(
      (path) =>
        !KNOWN_UNBUILT.has(path) && !routes.some((route) => route.test(path)),
    );
    expect(missing).toEqual([]);
  });
});
