// Shared role types and fail-closed, per-module permission maps.
export const SOCIETY_ROLES = [
  'admin',
  'committee',
  'guard',
  'hk_supervisor',
  'resident',
] as const;

export type SocietyRole = (typeof SOCIETY_ROLES)[number];

export const MODULE_KEYS = [
  'core',
  'visitor',
  'delivery',
  'billing',
  'service_request',
  'staff',
  'housekeeping',
  'amc',
  'notice',
  'amenity',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type PermissionMap = Readonly<Record<string, readonly SocietyRole[]>>;
export type PermissionMaps = Partial<
  Readonly<Record<ModuleKey, PermissionMap>>
>;

export const PERMISSION_MAPS: PermissionMaps = {
  core: {
    'society:read': ['admin', 'committee', 'guard'],
    'membership:read': ['admin', 'committee'],
    'membership:manage': ['admin'],
    'audit:read': ['admin', 'committee'],
  },
};

export function isSocietyRole(role: string): role is SocietyRole {
  return SOCIETY_ROLES.some((candidate) => candidate === role);
}

export function isModuleKey(moduleKey: string): moduleKey is ModuleKey {
  return MODULE_KEYS.some((candidate) => candidate === moduleKey);
}

export function hasPermission(
  roles: readonly SocietyRole[],
  moduleKey: ModuleKey,
  permission: string,
  maps: PermissionMaps = PERMISSION_MAPS,
): boolean {
  const allowedRoles = maps[moduleKey]?.[permission] ?? [];
  return roles.some((role) => allowedRoles.includes(role));
}
