// Authorize the admin home (A-01) and load its sections; the admin-only actions feed fails on its own.
import 'server-only';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import {
  adminHomeActionsSchema,
  adminHomeSnapshotSchema,
  type AdminHomeAction,
} from './admin-validation';

export type AdminActionsFeed =
  { status: 'ok'; items: AdminHomeAction[] } | { status: 'unavailable' } | null;

export async function getAdminHome() {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'dashboard:read',
  });
  const societyId = context.societyId;
  if (!societyId) throw new AppError('FORBIDDEN');
  const args = { p_society_id: societyId };
  const [snapshot, actions] = await Promise.all([
    callModuleRpc(
      context,
      'admin_home_get',
      args,
      adminHomeSnapshotSchema,
      'Dashboard could not be loaded.',
    ),
    context.roles.includes('admin')
      ? callModuleRpc(
          context,
          'admin_home_admin_actions',
          args,
          adminHomeActionsSchema,
          'Admin actions could not be loaded.',
        ).then(
          (items): AdminActionsFeed => ({ status: 'ok', items }),
          (): AdminActionsFeed => ({ status: 'unavailable' }),
        )
      : Promise.resolve<AdminActionsFeed>(null),
  ]);
  return {
    snapshot,
    actions,
    suspended: context.societyStatus === 'suspended',
  };
}

export type AdminHomeData = Awaited<ReturnType<typeof getAdminHome>>;
