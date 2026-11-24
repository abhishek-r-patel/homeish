// Load permitted societies and role places for the P54 shell picker.
import type { SocietyRole } from '../permissions';
import { getResidentFlatOptions } from '../home/workspace-operations';
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
  active: boolean;
  allFlats?: boolean;
  unitId?: string | null;
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
  const places: ShellPlace[] = (
    await Promise.all(
      context.memberships.map(async (membership) => {
        const societyName = societyNames.get(membership.societyId) ?? 'Society';
        const roles = new Set<SocietyRole>(membership.roles);
        const societyPlaces: ShellPlace[] = [];
        if (roles.has('resident')) {
          const flatOptions = await getResidentFlatOptions(
            context,
            membership.societyId,
          );
          if (flatOptions.length > 1) {
            societyPlaces.push(
              ...flatOptions.map((option) => ({
                societyId: membership.societyId,
                societyName,
                href: '/home',
                label: `${option.label} · My home`,
                active: option.selected,
                unitId: option.unit_id,
                allFlats: false,
              })),
              {
                societyId: membership.societyId,
                societyName,
                href: '/home',
                label: 'All my flats · My home',
                active: flatOptions.some((option) => option.all_flats),
                unitId: null,
                allFlats: true,
              },
            );
          } else {
            societyPlaces.push({
              societyId: membership.societyId,
              societyName,
              href: '/home',
              label: flatOptions[0]
                ? `${flatOptions[0].label} · My home`
                : 'My home',
              active: true,
              unitId: flatOptions[0]?.unit_id,
              allFlats: false,
            });
          }
        }
        if (roles.has('admin') || roles.has('committee')) {
          societyPlaces.push({
            societyId: membership.societyId,
            societyName,
            href: '/admin',
            label: bodyNames.get(membership.societyId) ?? 'Association',
            active: false,
          });
        }
        if (roles.has('guard')) {
          societyPlaces.push({
            societyId: membership.societyId,
            societyName,
            href: '/guard',
            label: 'Gate desk',
            active: false,
          });
        }
        if (roles.has('hk_supervisor')) {
          societyPlaces.push({
            societyId: membership.societyId,
            societyName,
            href: '/housekeeping',
            label: 'Housekeeping',
            active: false,
          });
        }
        return societyPlaces;
      }),
    )
  ).flat();

  return {
    activeSocietyId: context.societyId,
    places,
    societies: data.map((society) => ({
      id: society.id,
      name: society.name,
    })),
  };
}
