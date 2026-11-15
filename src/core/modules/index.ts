// Single source of truth for module metadata, settings hooks, navigation and permissions.
import { z } from 'zod';
import type {
  PermissionMap,
  PermissionMaps,
  SocietyRole,
} from '../permissions';
import { MODULE_KEYS, type ModuleKey } from './module-types';
import {
  billingSettingsSchema,
  DEFAULT_BILLING_SETTINGS,
} from '../billing/validation';
import {
  DEFAULT_SERVICE_REQUEST_SETTINGS,
  serviceRequestSettingsSchema,
} from '../service-requests/validation';
import {
  DEFAULT_STAFF_SETTINGS,
  staffSettingsSchema,
} from '../staff/validation';
import { amcSettingsSchema, DEFAULT_AMC_SETTINGS } from '../amc/validation';
import {
  DEFAULT_EXPENSE_SETTINGS,
  expenseSettingsSchema,
} from '../expense/validation';
import {
  DEFAULT_TENANCY_SETTINGS,
  tenancySettingsSchema,
} from '../tenancy/moves/validation';
import {
  DEFAULT_DOCUMENT_SETTINGS,
  documentSettingsSchema,
} from '../document/validation';
import {
  DEFAULT_PARKING_SETTINGS,
  parkingSettingsSchema,
} from '../parking/validation';
import { DEFAULT_SOS_SETTINGS, sosSettingsSchema } from '../sos/validation';

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
export const visitorSettingsSchema = z
  .object({
    approval_timeout_minutes: z.number().int().min(1).max(30).optional(),
    overstay_hours: z.number().int().min(1).max(72).optional(),
    photo_required: z.boolean().optional(),
    guard_override_allowed: z.boolean().optional(),
    phone_required: z.boolean().optional(),
  })
  .strict();
export const deliverySettingsSchema = z
  .object({
    response_timeout_minutes: z.number().int().min(1).max(30).optional(),
    uncollected_days: z.number().int().min(1).max(90).optional(),
    leave_at_gate_enabled: z.boolean().optional(),
  })
  .strict();

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
        {
          href: '/admin/structure',
          label: 'Structure',
          permission: 'structure:manage',
          section: 'Society',
        },
        {
          href: '/admin/members',
          label: 'People',
          permission: 'membership:read',
          section: 'Society',
        },
        {
          href: '/admin/settings',
          label: 'Registration',
          permission: 'membership:manage',
          section: 'Society',
        },
        {
          href: '/admin/guards',
          label: 'Gate & Guards',
          permission: 'guards:read',
          section: 'Society',
        },
        {
          href: '/admin/jobs',
          label: 'Jobs',
          permission: 'jobs:read',
          section: 'Operations',
        },
      ],
      committee: [
        {
          href: '/admin',
          label: 'Dashboard',
          permission: 'dashboard:read',
          section: 'Overview',
        },
        {
          href: '/admin/guards',
          label: 'Gate & Guards',
          permission: 'guards:read',
          section: 'Society',
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
        {
          href: '/household',
          label: 'Household',
          permission: 'household:read',
          section: 'Home',
        },
      ],
    },
    permissions: {
      'society:read': ['admin', 'committee', 'guard'],
      'structure:read': ['admin', 'committee', 'guard', 'resident'],
      'structure:manage': ['admin'],
      'jobs:read': ['admin'],
      'membership:read': ['admin', 'committee'],
      'membership:manage': ['admin'],
      'guards:read': ['admin', 'committee', 'guard'],
      'guards:manage': ['admin'],
      'gate:settings': ['admin'],
      'guard:identify': ['guard'],
      'contacts:read': ['guard', 'admin'],
      'household:read': ['resident'],
      'household:manage': ['resident'],
      'audit:read': ['admin', 'committee'],
      'home:read': ['guard', 'resident'],
      'dashboard:read': ['admin', 'committee', 'hk_supervisor'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  visitor: {
    core: false,
    defaultSettings: {
      approval_timeout_minutes: 3,
      overstay_hours: 12,
      photo_required: false,
      guard_override_allowed: false,
      phone_required: false,
    },
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
      committee: [
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
    permissions: {
      'visitor:list': ['admin', 'committee', 'guard', 'resident'],
      'visitor:create': ['admin', 'guard'],
      'visitor:decide': ['resident'],
      'visitor:override': ['guard'],
      'visitor:check_in': ['admin', 'guard'],
      'visitor:preapproval:create': ['resident'],
      'visitor:preapproval:cancel': ['admin', 'committee', 'resident'],
      'visitor:frequent:manage': ['resident'],
      'visitor:blacklist:read': ['admin', 'committee', 'guard'],
      'visitor:blacklist:manage': ['admin'],
      'visitor:settings:manage': ['admin'],
    },
    settingsAccess: { visitor: 'admin' },
    settingsSchema: visitorSettingsSchema,
  },
  delivery: {
    core: false,
    defaultSettings: {
      response_timeout_minutes: 3,
      uncollected_days: 3,
      leave_at_gate_enabled: true,
    },
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
      committee: [
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
    permissions: {
      'delivery:list': ['admin', 'committee', 'guard', 'resident'],
      'delivery:create': ['admin', 'guard'],
      'delivery:respond': ['resident'],
      'delivery:override': ['guard'],
      'delivery:collect': ['guard', 'resident'],
      'delivery:preference:read': ['admin', 'committee', 'resident'],
      'delivery:preference:manage': ['resident'],
      'delivery:announce': ['resident'],
      'delivery:settings:manage': ['admin'],
    },
    settingsAccess: { delivery: 'admin' },
    settingsSchema: deliverySettingsSchema,
  },
  billing: {
    core: false,
    defaultSettings: DEFAULT_BILLING_SETTINGS,
    key: 'billing',
    name: 'Maintenance, Fines & Payments',
    navigation: {
      admin: [
        {
          href: '/admin/billing',
          label: 'Billing',
          permission: 'billing:charges:read',
        },
      ],
      committee: [
        {
          href: '/admin/billing',
          label: 'Billing',
          permission: 'billing:charges:read',
        },
      ],
      resident: [
        {
          href: '/bills',
          label: 'Bills',
          permission: 'billing:bills:read',
        },
      ],
    },
    permissions: {
      'billing:charges:read': ['admin', 'committee'],
      'billing:charges:manage': ['admin'],
      'billing:settings:manage': ['admin'],
      'billing:bills:read': ['admin', 'committee', 'resident'],
      'billing:bills:manage': ['admin'],
      'billing:ledger:read': ['admin', 'committee', 'resident'],
      'billing:payments:read': ['admin', 'committee', 'resident'],
      'billing:payments:manage': ['admin'],
      'billing:payments:submit': ['resident'],
      'billing:payment_details:read': [
        'admin',
        'committee',
        'guard',
        'hk_supervisor',
        'resident',
      ],
      'billing:payment_details:manage': ['admin'],
    },
    settingsAccess: {
      due_day_of_month: 'admin',
      rounding: 'admin',
      billing: 'developer',
    },
    settingsSchema: billingSettingsSchema,
  },
  service_request: {
    core: false,
    defaultSettings: DEFAULT_SERVICE_REQUEST_SETTINGS,
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
    permissions: {
      'request:list': ['admin', 'committee', 'resident'],
      'request:create': ['admin', 'resident'],
      'request:categories:manage': ['admin'],
      'request:assign': ['admin'],
      'request:update': ['admin', 'committee', 'resident'],
      'request:reject': ['admin'],
      'request:close': ['resident'],
      'request:rate': ['resident'],
      'request:upvote': ['resident'],
      'request:comment': ['admin', 'committee', 'resident'],
      'request:assignees:list': ['admin'],
      'request:report': ['admin', 'committee'],
    },
    settingsAccess: { auto_close_days: 'developer' },
    settingsSchema: serviceRequestSettingsSchema,
  },
  staff: {
    core: false,
    defaultSettings: DEFAULT_STAFF_SETTINGS,
    key: 'staff',
    name: 'Staff Management',
    navigation: {
      admin: [
        { href: '/admin/staff', label: 'Staff', permission: 'staff:list' },
      ],
      guard: [
        {
          href: '/guard/staff',
          label: 'Staff entry',
          permission: 'staff:gate',
        },
      ],
      resident: [{ href: '/staff', label: 'Staff', permission: 'staff:list' }],
    },
    permissions: {
      'staff:list': ['admin', 'resident'],
      'staff:manage': ['admin'],
      'staff:review': ['admin'],
      'staff:settings:manage': ['admin'],
      'staff:register': ['resident'],
      'staff:attendance': ['admin', 'resident'],
      'staff:day_block': ['resident'],
      'staff:gate': ['guard'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: staffSettingsSchema,
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
      committee: [
        {
          href: '/admin/housekeeping',
          label: 'Housekeeping',
          permission: 'stock:list',
        },
      ],
    },
    permissions: {
      'stock:list': ['admin', 'hk_supervisor', 'committee'],
      'stock:manage': ['admin', 'hk_supervisor'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  amc: {
    core: false,
    defaultSettings: DEFAULT_AMC_SETTINGS,
    key: 'amc',
    name: 'AMC Management',
    navigation: {
      admin: [{ href: '/admin/amc', label: 'AMC', permission: 'amc:list' }],
      committee: [{ href: '/admin/amc', label: 'AMC', permission: 'amc:list' }],
    },
    permissions: {
      'amc:list': ['admin', 'committee'],
      'amc:manage': ['admin'],
    },
    settingsAccess: {
      reminder_days: 'developer',
      expiring_soon_days: 'developer',
    },
    settingsSchema: amcSettingsSchema,
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
    permissions: {
      'notice:list': ['admin', 'committee', 'resident'],
      'notice:create': ['admin', 'committee'],
      'notice:manage': ['admin', 'committee'],
      'notice:archive': ['admin', 'committee'],
    },
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
      committee: [
        {
          href: '/admin/amenities',
          label: 'Amenities',
          permission: 'amenity:list',
        },
      ],
    },
    permissions: {
      'amenity:list': ['admin', 'committee', 'resident'],
      'amenity:manage': ['admin'],
      'amenity:book': ['admin', 'resident'],
      'amenity:cancel': ['admin', 'resident'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  directory: {
    core: false,
    defaultSettings: emptySettings,
    key: 'directory',
    name: 'Resident & Vehicle Directory',
    navigation: {
      admin: [
        {
          href: '/admin/directory',
          label: 'Directory',
          permission: 'directory:list',
        },
      ],
      resident: [
        {
          href: '/directory',
          label: 'Directory',
          permission: 'directory:list',
        },
      ],
      committee: [
        {
          href: '/admin/directory',
          label: 'Directory',
          permission: 'directory:list',
        },
      ],
      guard: [
        {
          href: '/guard/directory',
          label: 'Vehicle lookup',
          permission: 'directory:lookup_vehicle',
        },
      ],
    },
    permissions: {
      'directory:list': ['admin', 'committee', 'resident'],
      'directory:manage': ['admin'],
      'directory:manage_household': ['resident'],
      'directory:lookup_vehicle': ['guard'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  expense: {
    core: false,
    defaultSettings: DEFAULT_EXPENSE_SETTINGS,
    key: 'expense',
    name: 'Society Expenses & Accounts',
    navigation: {
      admin: [
        {
          href: '/admin/expenses',
          label: 'Accounts',
          permission: 'expense:list',
        },
      ],
      committee: [
        {
          href: '/admin/expenses',
          label: 'Accounts',
          permission: 'expense:list',
        },
      ],
    },
    permissions: {
      'expense:list': ['admin', 'committee'],
      'expense:manage': ['admin'],
      'expense:approve': ['committee'],
    },
    // Admins change these through the validated expense setup screen.
    settingsAccess: {
      approval_threshold_paise: 'developer',
      billing_income_account_id: 'developer',
    },
    settingsSchema: expenseSettingsSchema,
  },
  tenancy: {
    core: false,
    defaultSettings: DEFAULT_TENANCY_SETTINGS,
    key: 'tenancy',
    name: 'Move-in, Move-out & Tenancy',
    navigation: {
      resident: [
        {
          href: '/tenancy',
          label: 'Move-in / Move-out',
          permission: 'tenancy:list',
        },
      ],
      admin: [
        {
          href: '/admin/tenancy',
          label: 'Move-in / Move-out',
          permission: 'tenancy:list',
        },
      ],
      committee: [
        {
          href: '/admin/tenancy',
          label: 'Moving schedule',
          permission: 'tenancy:list',
        },
      ],
      guard: [
        {
          href: '/guard/tenancy',
          label: 'Moving schedule',
          permission: 'tenancy:guard',
        },
      ],
    },
    permissions: {
      'tenancy:list': ['admin', 'committee', 'resident'],
      'tenancy:create': ['admin', 'resident'],
      'tenancy:consent': ['resident'],
      'tenancy:manage': ['admin'],
      'tenancy:files': ['admin', 'resident'],
      'tenancy:guard': ['guard'],
    },
    settingsAccess: { police_verification_required: 'admin' },
    settingsSchema: tenancySettingsSchema,
  },
  document: {
    core: false,
    defaultSettings: DEFAULT_DOCUMENT_SETTINGS,
    key: 'document',
    name: 'Document Repository',
    navigation: {
      resident: [
        {
          href: '/documents',
          label: 'Documents',
          permission: 'document:list',
        },
      ],
      admin: [
        {
          href: '/admin/documents',
          label: 'Documents',
          permission: 'document:list',
        },
      ],
      committee: [
        {
          href: '/admin/documents',
          label: 'Documents',
          permission: 'document:list',
        },
      ],
    },
    permissions: {
      'document:list': ['admin', 'committee', 'resident'],
      'document:manage': ['admin'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: documentSettingsSchema,
  },
  parking: {
    core: false,
    defaultSettings: DEFAULT_PARKING_SETTINGS,
    key: 'parking',
    name: 'Parking',
    navigation: {
      resident: [
        { href: '/parking', label: 'Parking', permission: 'parking:list' },
      ],
      admin: [
        {
          href: '/admin/parking',
          label: 'Parking',
          permission: 'parking:list',
        },
      ],
      committee: [
        {
          href: '/admin/parking',
          label: 'Parking',
          permission: 'parking:list',
        },
      ],
      guard: [
        {
          href: '/guard/parking',
          label: 'Parking',
          permission: 'parking:guard',
        },
      ],
    },
    permissions: {
      'parking:list': ['admin', 'committee', 'resident'],
      'parking:manage': ['admin'],
      'parking:request': ['resident'],
      'parking:visitor_pass': ['resident'],
      'parking:report': ['guard', 'resident'],
      'parking:guard': ['guard'],
    },
    settingsAccess: { photo_retention_days: 'admin' },
    settingsSchema: parkingSettingsSchema,
  },
  sos: {
    core: false,
    defaultSettings: DEFAULT_SOS_SETTINGS,
    key: 'sos',
    name: 'Emergency & SOS',
    navigation: {
      resident: [{ href: '/sos', label: 'Emergency', permission: 'sos:raise' }],
      admin: [
        { href: '/admin/sos', label: 'Emergency', permission: 'sos:list' },
      ],
      committee: [
        { href: '/admin/sos', label: 'Emergency', permission: 'sos:list' },
      ],
      guard: [
        { href: '/guard/sos', label: 'Emergency', permission: 'sos:respond' },
      ],
    },
    permissions: {
      'sos:raise': ['guard', 'resident'],
      'sos:list': ['admin', 'committee', 'guard', 'resident'],
      'sos:respond': ['admin', 'committee', 'guard'],
      'sos:manage': ['admin'],
    },
    settingsAccess: {
      notify_guards: 'admin',
      notify_admins: 'admin',
      notify_committee: 'admin',
      resident_scope: 'admin',
    },
    settingsSchema: sosSettingsSchema,
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
    'directory',
    'expense',
    'tenancy',
    'sos',
    'document',
    'parking',
  ],
  committee: [
    'core',
    'billing',
    'expense',
    'service_request',
    'delivery',
    'notice',
    'housekeeping',
    'amc',
    'amenity',
    'directory',
    'tenancy',
    'sos',
    'document',
    'parking',
  ],
  guard: [
    'core',
    'visitor',
    'delivery',
    'staff',
    'directory',
    'tenancy',
    'sos',
    'parking',
  ],
  hk_supervisor: ['core', 'housekeeping', 'staff'],
  resident: [
    'core',
    'visitor',
    'billing',
    'service_request',
    'delivery',
    'staff',
    'notice',
    'amenity',
    'directory',
    'tenancy',
    'sos',
    'document',
    'parking',
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
