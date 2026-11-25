// Build a synthetic role picture from the real registry and permission maps.
import {
  getRoleNavigationGroups,
  getRoleNavigation,
  getRoleTabs,
  type ModuleKey,
} from '../modules';
import type { SocietyRole } from '../permissions';
import { QUICK_ACTION_KEYS, resolveQuickActions } from './quick-actions';

export const ROLE_PREVIEW_ROLES = [
  'guard',
  'resident',
  'committee',
  'hk_supervisor',
] as const satisfies readonly SocietyRole[];
export type RolePreviewRole = (typeof ROLE_PREVIEW_ROLES)[number];

export const ROLE_PREVIEW_LABELS: Record<RolePreviewRole, string> = {
  guard: 'Guard',
  resident: 'Resident',
  committee: 'Committee member',
  hk_supervisor: 'Housekeeping supervisor',
};

export function buildRolePreview(
  role: RolePreviewRole,
  enabledModules: readonly ModuleKey[],
) {
  const grouped = getRoleNavigationGroups([role], enabledModules).map(
    (group) => ({
      name: group.topic,
      items: group.items.map((item) => item.label),
    }),
  );
  const groups = grouped.length
    ? grouped
    : [
        {
          name: 'Work',
          items: getRoleNavigation([role], enabledModules).map(
            (item) => item.label,
          ),
        },
      ];
  const tabs = getRoleTabs(role, enabledModules).map((item) => item.label);
  const actions = resolveQuickActions(
    role,
    enabledModules,
    QUICK_ACTION_KEYS,
  ).map((action) => action.label);
  return {
    role,
    label: ROLE_PREVIEW_LABELS[role],
    groups,
    tabs,
    actions,
  };
}

export function parseRolePreviewRole(value: unknown): RolePreviewRole {
  return typeof value === 'string' &&
    ROLE_PREVIEW_ROLES.includes(value as RolePreviewRole)
    ? (value as RolePreviewRole)
    : 'resident';
}
