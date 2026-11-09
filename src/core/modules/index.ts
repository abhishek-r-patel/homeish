// Single source of truth for module metadata, settings hooks, navigation and permissions.
import { z } from 'zod';
import type {
  PermissionMap,
  PermissionMaps,
  SocietyRole,
} from '../permissions';
import { MODULE_KEYS, type ModuleKey } from './module-types';

export { MODULE_KEYS };
export type { ModuleKey };

export type ModuleNavigationItem = {
  href: string;
  label: string;
  permission: string;
  section?: string;
};

export type ModuleDefinition = {
  core: boolean;
  defaultSettings: Readonly<Record<string, unknown>>;
  key: ModuleKey;
  name: string;
  navigation: Partial<
    Readonly<Record<SocietyRole, readonly ModuleNavigationItem[]>>
  >;
  permissions: PermissionMap;
  settingsAccess: Readonly<Record<string, 'admin' | 'developer'>>;
  settingsSchema: z.ZodType;
};

const emptySettingsSchema = z.object({}).strict();
const emptySettings: Readonly<Record<string, unknown>> = {};
const emptySettingsAccess: Readonly<Record<string, 'admin' | 'developer'>> = {};

export const MODULE_REGISTRY: Readonly<Record<ModuleKey, ModuleDefinition>> = {
  core: {
    core: true,
    defaultSettings: emptySettings,
    key: 'core',
    name: 'Core Platform',
    navigation: {
      admin: [
        {
          href: '/admin',
          label: 'Dashboard',
          permission: 'dashboard:read',
          section: 'Overview',
        },
      ],
      committee: [
        {
          href: '/admin',
          label: 'Dashboard',
          permission: 'dashboard:read',
          section: 'Overview',
        },
      ],
      guard: [
        {
          href: '/guard',
          label: 'Home',
          permission: 'home:read',
          section: 'Overview',
        },
      ],
      hk_supervisor: [
        {
          href: '/admin',
          label: 'Dashboard',
          permission: 'dashboard:read',
          section: 'Overview',
        },
      ],
      resident: [
        {
          href: '/home',
          label: 'Home',
          permission: 'home:read',
          section: 'Overview',
        },
      ],
    },
    permissions: {
      'society:read': ['admin', 'committee', 'guard'],
      'membership:read': ['admin', 'committee'],
      'membership:manage': ['admin'],
      'audit:read': ['admin', 'committee'],
      'home:read': ['guard', 'resident'],
      'dashboard:read': ['admin', 'committee', 'hk_supervisor'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  visitor: {
    core: false,
    defaultSettings: emptySettings,
    key: 'visitor',
    name: 'Visitor Management',
    navigation: {
      admin: [
        {
          href: '/admin/visitors',
          label: 'Visitors',
          permission: 'visitor:list',
        },
      ],
      guard: [
        {
          href: '/guard/visitors',
          label: 'Visitors',
          permission: 'visitor:list',
        },
      ],
      resident: [
        { href: '/visitors', label: 'Visitors', permission: 'visitor:list' },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  delivery: {
    core: false,
    defaultSettings: emptySettings,
    key: 'delivery',
    name: 'Delivery Management',
    navigation: {
      admin: [
        {
          href: '/admin/deliveries',
          label: 'Deliveries',
          permission: 'delivery:list',
        },
      ],
      guard: [
        {
          href: '/guard/deliveries',
          label: 'Deliveries',
          permission: 'delivery:list',
        },
      ],
      resident: [
        {
          href: '/deliveries',
          label: 'Deliveries',
          permission: 'delivery:list',
        },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  billing: {
    core: false,
    defaultSettings: emptySettings,
    key: 'billing',
    name: 'Maintenance, Fines & Payments',
    navigation: {
      admin: [
        { href: '/admin/billing', label: 'Billing', permission: 'bill:list' },
      ],
      committee: [
        { href: '/admin/billing', label: 'Billing', permission: 'bill:list' },
      ],
      resident: [{ href: '/bills', label: 'Bills', permission: 'bill:list' }],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  service_request: {
    core: false,
    defaultSettings: emptySettings,
    key: 'service_request',
    name: 'Service Requests',
    navigation: {
      admin: [
        {
          href: '/admin/requests',
          label: 'Requests',
          permission: 'request:list',
        },
      ],
      committee: [
        {
          href: '/admin/requests',
          label: 'Requests',
          permission: 'request:list',
        },
      ],
      resident: [
        { href: '/requests', label: 'Requests', permission: 'request:list' },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  staff: {
    core: false,
    defaultSettings: emptySettings,
    key: 'staff',
    name: 'Staff Management',
    navigation: {
      admin: [
        { href: '/admin/staff', label: 'Staff', permission: 'staff:list' },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  housekeeping: {
    core: false,
    defaultSettings: emptySettings,
    key: 'housekeeping',
    name: 'Housekeeping Inventory',
    navigation: {
      admin: [
        {
          href: '/admin/housekeeping',
          label: 'Housekeeping',
          permission: 'stock:list',
        },
      ],
      hk_supervisor: [
        {
          href: '/housekeeping',
          label: 'Housekeeping',
          permission: 'stock:list',
        },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  amc: {
    core: false,
    defaultSettings: emptySettings,
    key: 'amc',
    name: 'AMC Management',
    navigation: {
      admin: [{ href: '/admin/amc', label: 'AMC', permission: 'amc:list' }],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  notice: {
    core: false,
    defaultSettings: emptySettings,
    key: 'notice',
    name: 'Notice Board',
    navigation: {
      admin: [
        { href: '/admin/notices', label: 'Notices', permission: 'notice:list' },
      ],
      committee: [
        { href: '/admin/notices', label: 'Notices', permission: 'notice:list' },
      ],
      resident: [
        { href: '/notices', label: 'Notices', permission: 'notice:list' },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  amenity: {
    core: false,
    defaultSettings: emptySettings,
    key: 'amenity',
    name: 'Amenity Booking',
    navigation: {
      admin: [
        {
          href: '/admin/amenities',
          label: 'Amenities',
          permission: 'amenity:list',
        },
      ],
      resident: [
        { href: '/amenities', label: 'Amenities', permission: 'amenity:list' },
      ],
    },
    permissions: {},
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
};

export function getModuleDefinition(moduleKey: ModuleKey) {
  return MODULE_REGISTRY[moduleKey];
}

export function getModuleNavigation(moduleKey: ModuleKey, role: SocietyRole) {
  return MODULE_REGISTRY[moduleKey].navigation[role] ?? [];
}

export function parseModuleSettings(moduleKey: ModuleKey, settings: unknown) {
  return MODULE_REGISTRY[moduleKey].settingsSchema.parse(settings);
}

const ROLE_MODULE_ORDER: Readonly<Record<SocietyRole, readonly ModuleKey[]>> = {
  admin: [
    'core',
    'visitor',
    'billing',
    'service_request',
    'delivery',
    'staff',
    'housekeeping',
    'amc',
    'notice',
    'amenity',
  ],
  committee: ['core', 'billing', 'service_request'],
  guard: ['core', 'visitor', 'delivery'],
  hk_supervisor: ['core', 'housekeeping', 'staff'],
  resident: [
    'core',
    'visitor',
    'billing',
    'service_request',
    'delivery',
    'notice',
    'amenity',
  ],
};

export type RoleNavigationItem = ModuleNavigationItem & {
  moduleKey: ModuleKey;
};

export function getRoleNavigation(
  roles: readonly SocietyRole[],
  enabledModules: readonly ModuleKey[],
  permissionMaps?: PermissionMaps,
): RoleNavigationItem[] {
  const enabled = new Set<ModuleKey>(['core', ...enabledModules]);
  const destinations = new Map<
    string,
    RoleNavigationItem & { order: number }
  >();

  for (const role of roles) {
    for (const [order, moduleKey] of ROLE_MODULE_ORDER[role].entries()) {
      if (!enabled.has(moduleKey)) continue;
      const definition = MODULE_REGISTRY[moduleKey];
      const rolePermissions = definition.permissions;
      const modulePermissions = permissionMaps?.[moduleKey] ?? rolePermissions;

      for (const item of definition.navigation[role] ?? []) {
        if (!modulePermissions[item.permission]?.includes(role)) continue;
        const existing = destinations.get(item.href);
        const candidate = { ...item, moduleKey, order };
        if (!existing || order < existing.order) {
          destinations.set(item.href, candidate);
        }
      }
    }
  }

  return [...destinations.values()]
    .sort((left, right) => left.order - right.order)
    .map((item) => ({
      href: item.href,
      label: item.label,
      moduleKey: item.moduleKey,
      permission: item.permission,
      section: item.section,
    }));
}
