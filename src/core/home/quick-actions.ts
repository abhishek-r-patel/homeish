// Define and filter the shared P54 quick-action catalogue by role and module.
import type { ModuleKey } from '../modules';
import {
  hasPermission,
  type PermissionMaps,
  type SocietyRole,
} from '../permissions';

export const QUICK_ACTION_KEYS = [
  'notice.create',
  'billing.payment',
  'billing.generate',
  'expense.create',
  'poll.create',
  'request.review',
  'billing.view',
  'meeting.view',
  'visitor.preapprove',
  'request.create',
  'household.view',
  'visitor.manage',
  'delivery.manage',
  'rounds.manage',
  'staff.entry',
  'request.log',
  'inventory.manage',
  'petty_cash.view',
] as const;

export type QuickActionKey = (typeof QUICK_ACTION_KEYS)[number];

type QuickActionDefinition = {
  key: QuickActionKey;
  href: string | Partial<Record<SocietyRole, string>>;
  label: string;
  moduleKey: ModuleKey;
  permissions: Partial<Record<SocietyRole, string>>;
};

export const QUICK_ACTIONS: readonly QuickActionDefinition[] = [
  {
    key: 'notice.create',
    href: '/admin/notices/new',
    label: 'Post a notice',
    moduleKey: 'notice',
    permissions: {
      admin: 'notice:create',
      committee: 'notice:create',
    },
  },
  {
    key: 'billing.payment',
    href: '/admin/billing?tab=payments',
    label: 'Record a payment',
    moduleKey: 'billing',
    permissions: { admin: 'billing:payments:manage' },
  },
  {
    key: 'billing.generate',
    href: '/admin/billing/generate',
    label: 'Generate monthly bills',
    moduleKey: 'billing',
    permissions: { admin: 'billing:charges:manage' },
  },
  {
    key: 'expense.create',
    href: '/admin/expenses',
    label: 'Add an expense',
    moduleKey: 'expense',
    permissions: { admin: 'expense:manage' },
  },
  {
    key: 'poll.create',
    href: '/admin/polls/new',
    label: 'Create a poll',
    moduleKey: 'poll',
    permissions: { admin: 'poll:manage' },
  },
  {
    key: 'request.review',
    href: '/admin/requests',
    label: 'Review requests',
    moduleKey: 'service_request',
    permissions: {
      admin: 'request:list',
      committee: 'request:list',
    },
  },
  {
    key: 'billing.view',
    href: {
      admin: '/admin/billing',
      committee: '/admin/billing',
      resident: '/bills',
    },
    label: 'Pay or view my bill',
    moduleKey: 'billing',
    permissions: {
      admin: 'billing:charges:read',
      committee: 'billing:charges:read',
      resident: 'billing:bills:read',
    },
  },
  {
    key: 'meeting.view',
    href: '/admin/meetings',
    label: 'View meetings',
    moduleKey: 'meeting',
    permissions: { committee: 'meeting:list' },
  },
  {
    key: 'visitor.preapprove',
    href: '/visitors',
    label: 'Pre-approve a guest',
    moduleKey: 'visitor',
    permissions: { resident: 'visitor:preapproval:create' },
  },
  {
    key: 'request.create',
    href: '/requests/new',
    label: 'Raise a request',
    moduleKey: 'service_request',
    permissions: { resident: 'request:create' },
  },
  {
    key: 'household.view',
    href: '/household',
    label: 'My household',
    moduleKey: 'core',
    permissions: { resident: 'household:read' },
  },
  {
    key: 'visitor.manage',
    href: '/guard/visitors',
    label: 'Manage visitors',
    moduleKey: 'visitor',
    permissions: { guard: 'visitor:list' },
  },
  {
    key: 'delivery.manage',
    href: '/guard/deliveries',
    label: 'Manage deliveries',
    moduleKey: 'delivery',
    permissions: { guard: 'delivery:list' },
  },
  {
    key: 'rounds.manage',
    href: {
      guard: '/guard/rounds',
      hk_supervisor: '/housekeeping/rounds',
    },
    label: 'Daily checks',
    moduleKey: 'service_request',
    permissions: {
      guard: 'request:rounds',
      hk_supervisor: 'request:rounds',
    },
  },
  {
    key: 'staff.entry',
    href: '/guard/staff',
    label: 'Staff entry',
    moduleKey: 'staff',
    permissions: { guard: 'staff:gate' },
  },
  {
    key: 'request.log',
    href: '/housekeeping/requests/new',
    label: 'Log a request',
    moduleKey: 'service_request',
    permissions: { hk_supervisor: 'request:log' },
  },
  {
    key: 'inventory.manage',
    href: '/housekeeping',
    label: 'Housekeeping stock',
    moduleKey: 'housekeeping',
    permissions: { hk_supervisor: 'stock:list' },
  },
  {
    key: 'petty_cash.view',
    href: '/petty-cash',
    label: 'Petty cash',
    moduleKey: 'expense',
    permissions: {
      admin: 'expense:list',
      hk_supervisor: 'expense:list',
    },
  },
];

export function resolveQuickActions(
  role: SocietyRole,
  enabledModules: readonly ModuleKey[],
  configuredKeys: readonly string[],
  permissionMaps?: PermissionMaps,
) {
  const enabled = new Set<ModuleKey>(enabledModules);
  enabled.add('core');
  return configuredKeys.flatMap((key) => {
    const action = QUICK_ACTIONS.find((candidate) => candidate.key === key);
    if (!action || !enabled.has(action.moduleKey)) return [];
    const permission = action.permissions[role];
    if (!permission) return [];
    const permissions =
      permissionMaps?.[action.moduleKey]?.[permission] ?? undefined;
    if (
      permissions
        ? !permissions.includes(role)
        : !hasPermission([role], action.moduleKey, permission)
    ) {
      return [];
    }
    const href =
      typeof action.href === 'string' ? action.href : action.href[role];
    return href ? [{ ...action, href }] : [];
  });
}
