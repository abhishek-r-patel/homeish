// Apply API 2.5 checks in order; unregistered permissions deny by default.
import { AppError } from '../errors';
import type { ModuleKey, PermissionMaps } from './index';
import { hasPermission, PERMISSION_MAPS } from './index';
import type { RequestContext } from '../tenancy/request-context';

export interface AuthorizationRequirement {
  moduleKey?: ModuleKey;
  permission?: string;
  write?: boolean;
  developer?: boolean;
  requireRecentMfa?: boolean;
}

export function authorizeRequest(
  context: RequestContext,
  requirement: AuthorizationRequirement,
  permissionMaps: PermissionMaps = PERMISSION_MAPS,
): void {
  if (requirement.developer && !context.isDeveloper) {
    throw new AppError('FORBIDDEN');
  }
  if (requirement.requireRecentMfa && !context.mfaVerified) {
    throw new AppError('MFA_REQUIRED');
  }

  const moduleKey =
    requirement.moduleKey ?? (requirement.permission ? 'core' : undefined);
  if (!moduleKey) {
    return;
  }
  if (!context.societyId || !context.societyStatus) {
    throw new AppError('FORBIDDEN');
  }
  if (context.societyStatus === 'archived') {
    throw new AppError('SOCIETY_ARCHIVED');
  }
  if (requirement.write && context.societyStatus === 'suspended') {
    throw new AppError('SOCIETY_SUSPENDED');
  }
  if (!context.enabledModules.has(moduleKey)) {
    throw new AppError('MODULE_DISABLED');
  }
  if (
    requirement.permission &&
    !hasPermission(
      context.roles,
      moduleKey,
      requirement.permission,
      permissionMaps,
    )
  ) {
    throw new AppError('FORBIDDEN');
  }
}
