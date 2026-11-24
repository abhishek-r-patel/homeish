// Authorize the resident home and load only the active household's enabled modules.
import 'server-only';
import { readResidentOutstanding } from '../billing/queries';
import { AppError, createRequestId } from '../errors';
import { getRoleNavigation } from '../modules';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { residentHomeSnapshotSchema } from './validation';
import { getComingUp, getResidentDashboardGraph } from './dashboard-reads';
import { getConfiguredQuickActions } from './workspace-operations';

export async function getResidentHome() {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { moduleKey: 'core', permission: 'home:read' });
  if (!context.societyId || !context.roles.includes('resident')) {
    throw new AppError('FORBIDDEN');
  }
  const societyId = context.societyId;
  const [result, outstanding] = await Promise.all([
    context.db.rpc('resident_home_get', { p_society_id: societyId }),
    context.enabledModules.has('billing')
      ? readResidentOutstanding(context)
      : Promise.resolve(null),
  ]);
  if (result.error) {
    if (result.error.code === '42501') throw new AppError('FORBIDDEN');
    throw new Error('Resident home could not be loaded.', {
      cause: { code: result.error.code ?? 'unknown' },
    });
  }
  const [quickActions, comingUp, graph] = await Promise.all([
    getConfiguredQuickActions(context, 'resident'),
    getComingUp(context),
    getResidentDashboardGraph(context),
  ]);
  return {
    snapshot: residentHomeSnapshotSchema.parse(result.data),
    outstanding,
    quickActions,
    comingUp,
    graph,
    shortcuts: getRoleNavigation(['resident'], [...context.enabledModules])
      .filter((item) => item.moduleKey !== 'core')
      .map(({ href, label, moduleKey }) => ({ href, label, moduleKey })),
    societyId,
    suspended: context.societyStatus === 'suspended',
    userId: context.userId,
    visitorEnabled: context.enabledModules.has('visitor'),
    deliveryEnabled: context.enabledModules.has('delivery'),
  };
}

export type ResidentHomeData = Awaited<ReturnType<typeof getResidentHome>>;
