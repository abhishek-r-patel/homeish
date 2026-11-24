// Read effective per-society module setting ownership for admin screens.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import type { ModuleKey } from '../permissions';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';

const accessSchema = z.array(
  z.object({
    module_key: z.string(),
    setting_key: z.string(),
    admin_can_edit: z.boolean(),
  }),
);

export async function getModuleSettingAccess(
  moduleKey: ModuleKey,
  context?: RequestContext,
) {
  const resolved = context ?? (await buildRequestContext(createRequestId()));
  if (!resolved.societyId) throw new AppError('FORBIDDEN');
  const rows = await callModuleRpc(
    resolved,
    'module_setting_access_list',
    { p_society_id: resolved.societyId },
    accessSchema,
    'Setting access could not be loaded.',
  );
  return new Map(
    rows
      .filter((row) => row.module_key === moduleKey)
      .map((row) => [row.setting_key, row.admin_can_edit]),
  );
}

export async function canAdminEditAllModuleSettings(
  moduleKey: ModuleKey,
  context?: RequestContext,
) {
  if (context && !context.roles.includes('admin')) return false;
  const access = await getModuleSettingAccess(moduleKey, context);
  const values = [...access.values()];
  return values.length > 0 && values.every(Boolean);
}
