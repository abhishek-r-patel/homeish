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
import {
  DEFAULT_VENDOR_SETTINGS,
  vendorSettingsSchema,
} from '../vendor/validation';
import {
  DEFAULT_PATROL_SETTINGS,
  patrolSettingsSchema,
} from '../patrol/validation';
import {
  DEFAULT_METERING_SETTINGS,
  meteringSettingsSchema,
} from '../metering/validation';
import {
  assetSettingsSchema,
  DEFAULT_ASSET_SETTINGS,
} from '../asset/validation';
import {
  DEFAULT_HOME_SERVICES_SETTINGS,
  homeServicesSettingsSchema,
} from '../home-services/validation';
import { DEFAULT_POLL_SETTINGS, pollSettingsSchema } from '../poll/validation';
import {
  DEFAULT_MEETING_SETTINGS,
  meetingSettingsSchema,
} from '../meeting/validation';
import {
  DEFAULT_EVENT_SETTINGS,
  eventSettingsSchema,
} from '../event/validation';
import {
  DEFAULT_COMMUNITY_SETTINGS,
  communitySettingsSchema,
} from '../community/validation';

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
          href: '/admin/analytics',
          label: 'Analytics',
          permission: 'analytics:read',
          section: 'Overview',
        },
        {
          href: '/admin/communication',
          label: 'Communication',
          permission: 'communication:read',
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
          href: '/admin/society-profile',
          label: 'Society profile',
          permission: 'society_profile:read',
          section: 'Society',
        },
        {
          href: '/admin/adoption',
          label: 'Adoption tracker',
          permission: 'adoption:read',
          section: 'Society',
        },
        {
          href: '/admin/jobs',
          label: 'Jobs',
          permission: 'jobs:read',
          section: 'Operations',
        },
        {
          href: '/admin/action-plans',
          label: 'Action plans',
          permission: 'action_plan:manage',
          section: 'Operations',
        },
        {
          href: '/admin/letters',
          label: 'Letters',
          permission: 'letters:make',
          section: 'Operations',
        },
        {
          href: '/admin/contact-log',
          label: 'Contact log',
          permission: 'contact_log:read',
          section: 'Operations',
        },
        {
          href: '/help',
          label: 'Help',
          permission: 'help:read',
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
        {
          href: '/admin/analytics',
          label: 'Analytics',
          permission: 'analytics:read',
          section: 'Overview',
        },
        {
          href: '/admin/communication',
          label: 'Communication',
          permission: 'communication:read',
          section: 'Overview',
        },
        {
          href: '/admin/structure',
          label: 'Building layout',
          permission: 'structure:layout:read',
          section: 'Society',
        },
        {
          href: '/admin/guards',
          label: 'Gate & Guards',
          permission: 'guards:read',
          section: 'Society',
        },
        {
          href: '/admin/society-profile',
          label: 'Society profile',
          permission: 'society_profile:read',
          section: 'Society',
        },
        {
          href: '/admin/adoption',
          label: 'Adoption tracker',
          permission: 'adoption:read',
          section: 'Society',
        },
        {
          href: '/admin/action-plans',
          label: 'Action plans',
          permission: 'action_plan:manage',
          section: 'Operations',
        },
        {
          href: '/admin/letters',
          label: 'Letters',
          permission: 'letters:make',
          section: 'Operations',
        },
        {
          href: '/admin/contact-log',
          label: 'Contact log',
          permission: 'contact_log:read',
          section: 'Operations',
        },
        {
          href: '/help',
          label: 'Help',
          permission: 'help:read',
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
        {
          href: '/action-plans',
          label: 'My tasks',
          permission: 'action_plan:own',
          section: 'Overview',
        },
        {
          href: '/help',
          label: 'Help',
          permission: 'help:read',
          section: 'Overview',
        },
      ],
      hk_supervisor: [
        {
          href: '/action-plans',
          label: 'My tasks',
          permission: 'action_plan:own',
          section: 'Overview',
        },
        {
          href: '/help',
          label: 'Help',
          permission: 'help:read',
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
        {
          href: '/action-plans',
          label: 'My tasks',
          permission: 'action_plan:own',
          section: 'Home',
        },
        {
          href: '/help',
          label: 'Help',
          permission: 'help:read',
          section: 'Overview',
        },
      ],
    },
    permissions: {
      'society:read': ['admin', 'committee', 'guard'],
      'structure:read': ['admin', 'committee', 'guard', 'resident'],
      'structure:manage': ['admin'],
      'structure:layout:read': ['admin', 'committee'],
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
      'dashboard:read': ['admin', 'committee'],
      'analytics:read': ['admin', 'committee'],
      'analytics:manage': ['admin'],
      'analytics:export': ['admin'],
      'society_profile:read': ['admin', 'committee'],
      'society_profile:manage': ['admin'],
      'adoption:read': ['admin', 'committee'],
      'adoption:manage': ['admin'],
      'action_plan:manage': ['admin', 'committee'],
      'action_plan:delete_task': ['admin'],
      'action_plan:own': [
        'admin',
        'committee',
        'guard',
        'hk_supervisor',
        'resident',
      ],
      'help:read': ['admin', 'committee', 'guard', 'hk_supervisor', 'resident'],
      'letters:make': ['admin', 'committee'],
      'contact_log:read': ['admin', 'committee'],
      'contact_log:manage': ['admin'],
      'communication:read': ['admin', 'committee'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: emptySettingsSchema,
  },
  language: {
    core: false,
    defaultSettings: emptySettings,
    key: 'language',
    name: 'Language Support',
    navigation: {
      admin: [
        {
          href: '/admin/settings#language',
          label: 'Language',
          permission: 'language:read',
          section: 'Society',
        },
      ],
      committee: [
        {
          href: '/admin/settings#language',
          label: 'Language',
          permission: 'language:read',
          section: 'Society',
        },
      ],
    },
    permissions: {
      'language:read': ['admin', 'committee'],
      'language:manage': ['admin'],
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
      'billing:monthly_report:export': ['admin'],
      'billing:dues_follow_up:read': ['admin'],
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
      hk_supervisor: [
        {
          href: '/housekeeping/requests/new',
          label: 'Log a request',
          permission: 'request:log',
        },
        {
          href: '/housekeeping/rounds',
          label: 'Daily checks',
          permission: 'request:rounds',
        },
      ],
      guard: [
        {
          href: '/guard/rounds',
          label: 'Daily checks',
          permission: 'request:rounds',
        },
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
      'request:log': ['admin', 'hk_supervisor'],
      'request:hold': ['admin'],
      'request:priority': ['admin'],
      'request:rounds': ['admin', 'hk_supervisor', 'guard'],
      'request:rounds:manage': ['admin'],
      'request:escalation:respond': ['admin', 'committee'],
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
      committee: [
        {
          href: '/admin/staff',
          label: 'Staff',
          permission: 'staff:notes:read',
        },
      ],
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
      'staff:notes:read': ['admin', 'committee'],
      'staff:notes:manage': ['admin'],
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
      due_soon_days: 'admin',
      urgent_days: 'admin',
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
      'notice:plan': ['admin'],
      'notice:propose_plan': ['committee'],
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
  vendor: {
    core: false,
    defaultSettings: DEFAULT_VENDOR_SETTINGS,
    key: 'vendor',
    name: 'Vendors & Purchases',
    navigation: {
      admin: [
        { href: '/admin/vendors', label: 'Vendors', permission: 'vendor:list' },
      ],
      committee: [
        { href: '/admin/vendors', label: 'Vendors', permission: 'vendor:list' },
      ],
    },
    permissions: {
      'vendor:list': ['admin', 'committee'],
      'vendor:manage': ['admin'],
      'vendor:request': ['admin', 'committee'],
      'vendor:approve': ['admin', 'committee'],
      'vendor:rate': ['admin', 'committee'],
    },
    settingsAccess: {
      quote_threshold_paise: 'admin',
      quotes_above_threshold: 'admin',
      approvals_required: 'admin',
    },
    settingsSchema: vendorSettingsSchema,
  },
  patrol: {
    core: false,
    defaultSettings: DEFAULT_PATROL_SETTINGS,
    key: 'patrol',
    name: 'Guard Patrol',
    navigation: {
      admin: [
        { href: '/admin/patrol', label: 'Patrol', permission: 'patrol:list' },
      ],
      committee: [
        { href: '/admin/patrol', label: 'Patrol', permission: 'patrol:list' },
      ],
      guard: [
        { href: '/guard/patrol', label: 'Patrol', permission: 'patrol:guard' },
      ],
    },
    permissions: {
      'patrol:list': ['admin', 'committee'],
      'patrol:manage': ['admin'],
      'patrol:guard': ['guard'],
    },
    settingsAccess: { photo_retention_days: 'admin' },
    settingsSchema: patrolSettingsSchema,
  },
  metering: {
    core: false,
    defaultSettings: DEFAULT_METERING_SETTINGS,
    key: 'metering',
    name: 'Utility Metering',
    navigation: {
      resident: [
        { href: '/metering', label: 'Meters', permission: 'metering:list' },
      ],
      admin: [
        {
          href: '/admin/metering',
          label: 'Meters',
          permission: 'metering:list',
        },
      ],
      committee: [
        {
          href: '/admin/metering',
          label: 'Meters',
          permission: 'metering:list',
        },
      ],
      guard: [
        {
          href: '/guard/metering',
          label: 'Meters',
          permission: 'metering:record',
        },
      ],
    },
    permissions: {
      'metering:list': ['admin', 'committee', 'resident'],
      'metering:manage': ['admin'],
      'metering:record': ['admin', 'guard'],
      'metering:submit': ['resident'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: meteringSettingsSchema,
  },
  asset: {
    core: false,
    defaultSettings: DEFAULT_ASSET_SETTINGS,
    key: 'asset',
    name: 'Asset Register',
    navigation: {
      admin: [
        { href: '/admin/assets', label: 'Assets', permission: 'asset:list' },
      ],
      committee: [
        { href: '/admin/assets', label: 'Assets', permission: 'asset:list' },
      ],
    },
    permissions: {
      'asset:list': ['admin', 'committee'],
      'asset:manage': ['admin'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: assetSettingsSchema,
  },
  home_services: {
    core: false,
    defaultSettings: DEFAULT_HOME_SERVICES_SETTINGS,
    key: 'home_services',
    name: 'Home Services',
    navigation: {
      resident: [
        {
          href: '/home-services',
          label: 'Home services',
          permission: 'home_services:list',
        },
      ],
      admin: [
        {
          href: '/admin/home-services',
          label: 'Home services',
          permission: 'home_services:list',
        },
      ],
      committee: [
        {
          href: '/admin/home-services',
          label: 'Home services',
          permission: 'home_services:list',
        },
      ],
    },
    permissions: {
      'home_services:list': ['admin', 'committee', 'resident'],
      'home_services:manage': ['admin'],
      'home_services:suggest': ['committee'],
      'home_services:rate': ['resident'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: homeServicesSettingsSchema,
  },
  poll: {
    core: false,
    defaultSettings: DEFAULT_POLL_SETTINGS,
    key: 'poll',
    name: 'Polls & Voting',
    navigation: {
      resident: [{ href: '/polls', label: 'Polls', permission: 'poll:vote' }],
      admin: [
        { href: '/admin/polls', label: 'Polls', permission: 'poll:list' },
      ],
      committee: [
        { href: '/admin/polls', label: 'Polls', permission: 'poll:list' },
      ],
    },
    permissions: {
      'poll:vote': ['resident'],
      'poll:list': ['admin', 'committee'],
      'poll:manage': ['admin'],
    },
    settingsAccess: { tenant_voting_default: 'admin' },
    settingsSchema: pollSettingsSchema,
  },
  meeting: {
    core: false,
    defaultSettings: DEFAULT_MEETING_SETTINGS,
    key: 'meeting',
    name: 'Meetings & AGM',
    navigation: {
      resident: [
        { href: '/meetings', label: 'Meetings', permission: 'meeting:attend' },
      ],
      admin: [
        {
          href: '/admin/meetings',
          label: 'Meetings',
          permission: 'meeting:list',
        },
      ],
      committee: [
        {
          href: '/admin/meetings',
          label: 'Meetings',
          permission: 'meeting:list',
        },
      ],
    },
    permissions: {
      'meeting:attend': ['resident'],
      'meeting:list': ['admin', 'committee'],
      'meeting:minutes': ['admin', 'committee'],
      'meeting:manage': ['admin'],
    },
    settingsAccess: {
      notice_days_agm: 'admin',
      notice_days_sgm: 'admin',
      notice_days_committee: 'admin',
      quorum_percent_units: 'admin',
      quorum_percent_committee: 'admin',
      action_owner_scope: 'admin',
    },
    settingsSchema: meetingSettingsSchema,
  },
  event: {
    core: false,
    defaultSettings: DEFAULT_EVENT_SETTINGS,
    key: 'event',
    name: 'Events & RSVPs',
    navigation: {
      resident: [
        { href: '/events', label: 'Events', permission: 'event:attend' },
      ],
      admin: [
        { href: '/admin/events', label: 'Events', permission: 'event:list' },
      ],
      committee: [
        { href: '/admin/events', label: 'Events', permission: 'event:list' },
      ],
    },
    permissions: {
      'event:attend': ['resident'],
      'event:list': ['admin', 'committee'],
      'event:manage': ['admin', 'committee'],
    },
    settingsAccess: emptySettingsAccess,
    settingsSchema: eventSettingsSchema,
  },
  community: {
    core: false,
    defaultSettings: DEFAULT_COMMUNITY_SETTINGS,
    key: 'community',
    name: 'Community & Marketplace',
    navigation: {
      resident: [
        {
          href: '/community',
          label: 'Community',
          permission: 'community:participate',
        },
      ],
      admin: [
        {
          href: '/admin/community',
          label: 'Community',
          permission: 'community:moderate',
        },
      ],
    },
    permissions: {
      'community:participate': ['resident'],
      'community:moderate': ['admin'],
    },
    settingsAccess: {
      muted_can_edit_pending: 'admin',
      muted_can_report: 'admin',
      muted_can_renew: 'admin',
    },
    settingsSchema: communitySettingsSchema,
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
    'language',
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
    'vendor',
    'patrol',
    'metering',
    'asset',
    'home_services',
    'poll',
    'meeting',
    'event',
    'community',
  ],
  committee: [
    'core',
    'language',
    'billing',
    'expense',
    'service_request',
    'delivery',
    'notice',
    'housekeeping',
    'staff',
    'amc',
    'amenity',
    'directory',
    'tenancy',
    'sos',
    'document',
    'parking',
    'vendor',
    'patrol',
    'metering',
    'asset',
    'home_services',
    'poll',
    'meeting',
    'event',
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
    'patrol',
    'metering',
    'service_request',
  ],
  hk_supervisor: ['core', 'housekeeping', 'service_request', 'staff'],
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
    'metering',
    'home_services',
    'poll',
    'meeting',
    'event',
    'community',
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
