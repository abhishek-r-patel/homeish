// Shared role types and fail-closed, per-module permission maps.
import { MODULE_KEYS, MODULE_REGISTRY } from '../modules';
import type { ModuleKey } from '../modules';

export { MODULE_KEYS };
export type { ModuleKey };

export const SOCIETY_ROLES = [
  'admin',
  'committee',
  'guard',
  'hk_supervisor',
  'resident',
] as const;

export type SocietyRole = (typeof SOCIETY_ROLES)[number];

export type PermissionMap = Readonly<Record<string, readonly SocietyRole[]>>;
export type PermissionMaps = Partial<
  Readonly<Record<ModuleKey, PermissionMap>>
>;

const permissionMaps: Partial<Record<ModuleKey, PermissionMap>> = {};
for (const moduleKey of MODULE_KEYS) {
  permissionMaps[moduleKey] = MODULE_REGISTRY[moduleKey].permissions;
}
export const PERMISSION_MAPS: PermissionMaps = permissionMaps;

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
