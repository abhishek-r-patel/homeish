// Resolve a permitted account starting place and device-last-route safely.
import type { SocietyRole } from '../permissions';

export type StartingPlace =
  'last_used' | 'home' | 'work' | 'gate' | 'housekeeping';

const ROUTES: Readonly<Record<Exclude<StartingPlace, 'last_used'>, string>> = {
  home: '/home',
  work: '/admin',
  gate: '/guard',
  housekeeping: '/housekeeping',
};

const PLACE_ROLES: Readonly<
  Record<Exclude<StartingPlace, 'last_used'>, readonly SocietyRole[]>
> = {
  home: ['resident'],
  work: ['admin', 'committee'],
  gate: ['guard'],
  housekeeping: ['hk_supervisor'],
};

export function resolveStartingPlace(
  roles: readonly SocietyRole[],
  preferred: StartingPlace,
  lastUsed: string | null,
) {
  const available = (place: Exclude<StartingPlace, 'last_used'>) =>
    PLACE_ROLES[place].some((role) => roles.includes(role));

  if (preferred !== 'last_used' && available(preferred)) {
    return ROUTES[preferred];
  }
  if (
    preferred === 'last_used' &&
    lastUsed &&
    Object.entries(ROUTES).some(
      ([place, href]) =>
        href === lastUsed &&
        available(place as Exclude<StartingPlace, 'last_used'>),
    )
  ) {
    return lastUsed;
  }
  if (available('work')) return ROUTES.work;
  if (available('home')) return ROUTES.home;
  if (available('gate')) return ROUTES.gate;
  return ROUTES.housekeeping;
}
