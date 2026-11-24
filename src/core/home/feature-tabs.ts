// Build P55 cross-feature tab sets from the existing permission and module registries.
import 'server-only';
import { AppError, createRequestId } from '../errors';
import { getRoleNavigation } from '../modules';
import { buildRequestContext } from '../tenancy/request-context';

export type FeatureTabGroup =
  'accounts' | 'people' | 'gate' | 'meetings-notices' | 'upkeep';

const GROUP_PATHS: Readonly<Record<FeatureTabGroup, readonly string[]>> = {
  accounts: ['/admin/billing', '/admin/expenses', '/admin/expenses/funds'],
  people: ['/admin/members', '/admin/directory', '/admin/staff'],
  gate: ['/admin/visitors', '/admin/deliveries'],
  'meetings-notices': ['/admin/notices', '/admin/polls', '/admin/meetings'],
  upkeep: [
    '/admin/requests',
    '/admin/assets',
    '/admin/amc',
    '/admin/housekeeping',
  ],
};

export async function getFeatureTabs(group: FeatureTabGroup) {
  const context = await buildRequestContext(createRequestId());
  if (!context.roles.some((role) => role === 'admin' || role === 'committee')) {
    throw new AppError('FORBIDDEN');
  }
  const navigation = getRoleNavigation(context.roles, [
    ...context.enabledModules,
  ]);
  return GROUP_PATHS[group].flatMap((href) => {
    const item = navigation.find((candidate) => candidate.href === href);
    return item
      ? [{ href: item.href, label: item.label, moduleKey: item.moduleKey }]
      : [];
  });
}
