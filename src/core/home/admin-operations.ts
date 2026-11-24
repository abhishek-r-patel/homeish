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
import { getBillingMonthlyCollection } from '../billing/collection-operations';
import { getComingUp } from './dashboard-reads';
import {
  getAllowedQuickActions,
  getConfiguredQuickActions,
} from './workspace-operations';
import { getManagingBodyName } from '../tenancy/workspace-settings';
import { getGettingStarted } from './workspace-discovery';

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
  const role = context.roles.includes('admin') ? 'admin' : 'committee';
  const [
    quickActions,
    allQuickActions,
    comingUp,
    collectionGraph,
    managingBodyName,
    gettingStarted,
  ] = await Promise.all([
    getConfiguredQuickActions(context, role),
    getAllowedQuickActions(context, role),
    getComingUp(context),
    snapshot.billing?.status === 'ok' && context.enabledModules.has('billing')
      ? getBillingMonthlyCollection('6m', snapshot.timezone)
      : Promise.resolve(null),
    getManagingBodyName(context),
    role === 'admin' ? getGettingStarted() : Promise.resolve(null),
  ]);
  return {
    snapshot,
    actions,
    quickActions,
    allQuickActions,
    comingUp,
    collectionGraph,
    managingBodyName,
    gettingStarted,
    suspended: context.societyStatus === 'suspended',
  };
}

export type AdminHomeData = Awaited<ReturnType<typeof getAdminHome>>;
