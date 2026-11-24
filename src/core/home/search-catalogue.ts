// Filter P55 page and action search results from the shared registries.
import { getRoleNavigation } from '../modules';
import type { ModuleKey } from '../modules';
import type { SocietyRole } from '../permissions';
import { QUICK_ACTION_KEYS, resolveQuickActions } from './quick-actions';

export function searchWorkspaceCatalogue(
  roles: readonly SocietyRole[],
  enabledModules: readonly ModuleKey[],
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  const pages = getRoleNavigation(roles, enabledModules)
    .filter(
      (item) =>
        item.label.toLocaleLowerCase().includes(normalized) ||
        item.topic.toLocaleLowerCase().includes(normalized),
    )
    .map((item) => ({
      kind: 'page' as const,
      href: item.href,
      label: item.label,
      moduleKey: item.moduleKey,
      topic: item.topic,
    }));
  const role = roles.includes('resident')
    ? 'resident'
    : roles.includes('admin')
      ? 'admin'
      : roles.includes('committee')
        ? 'committee'
        : roles.includes('guard')
          ? 'guard'
          : roles.includes('hk_supervisor')
            ? 'hk_supervisor'
            : null;
  const actions = role
    ? resolveQuickActions(role, enabledModules, QUICK_ACTION_KEYS)
        .filter((action) =>
          action.label.toLocaleLowerCase().includes(normalized),
        )
        .map((action) => ({ ...action, kind: 'action' as const }))
    : [];
  return { pages, actions };
}
