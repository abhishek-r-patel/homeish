// Load permitted societies and role places for the P54 shell picker.
import type { SocietyRole } from '../permissions';
import type { RequestContext } from './request-context';

export interface ShellSociety {
  id: string;
  name: string;
}

export interface ShellPlace {
  societyId: string;
  societyName: string;
  href: string;
  label: string;
}

export async function getShellData(context: RequestContext) {
  const { data, error } = await context.db
    .from('societies')
    .select('id, name')
    .in(
      'id',
      context.memberships.map((membership) => membership.societyId),
    );
  if (error) {
    throw new Error('Could not load the society picker.', { cause: error });
  }
  const { data: profileRows, error: profileError } = await context.db
    .from('society_reference_profiles')
    .select('society_id, managing_body_name')
    .in(
      'society_id',
      context.memberships.map((membership) => membership.societyId),
    );
  if (profileError) {
    throw new Error('Could not load managing-body names.', {
      cause: profileError,
    });
  }
  const bodyNames = new Map(
    profileRows.map((row) => [row.society_id, row.managing_body_name]),
  );
  const societyNames = new Map(
    data.map((society) => [society.id, society.name]),
  );
  const places: ShellPlace[] = context.memberships.flatMap((membership) => {
    const societyName = societyNames.get(membership.societyId) ?? 'Society';
    const roles = new Set<SocietyRole>(membership.roles);
    const societyPlaces: ShellPlace[] = [];
    if (roles.has('resident')) {
      societyPlaces.push({
        societyId: membership.societyId,
        societyName,
        href: '/home',
        label: 'My home',
      });
    }
    if (roles.has('admin') || roles.has('committee')) {
      societyPlaces.push({
        societyId: membership.societyId,
        societyName,
        href: '/admin',
        label: bodyNames.get(membership.societyId) ?? 'Association',
      });
    }
    if (roles.has('guard')) {
      societyPlaces.push({
        societyId: membership.societyId,
        societyName,
        href: '/guard',
        label: 'Gate desk',
      });
    }
    if (roles.has('hk_supervisor')) {
      societyPlaces.push({
        societyId: membership.societyId,
        societyName,
        href: '/housekeeping',
        label: 'Housekeeping',
      });
    }
    return societyPlaces;
  });

  return {
    activeSocietyId: context.societyId,
    places,
    societies: data.map((society) => ({
      id: society.id,
      name: society.name,
    })),
  };
}
