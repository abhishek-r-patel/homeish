// Load the P35 society profile, adoption and action-plan screens and map failures to safe route states.
import 'server-only';
import {
  saveActionPlanAction,
  createSampleActionPlanAction,
  saveActionTaskAction,
  deleteActionTaskAction,
  setActionPlanArchivedAction,
} from '@/app/(admin)/admin/action-plans/actions';
import { saveCapabilityAdoptionAction } from '@/app/(admin)/admin/adoption/actions';
import { saveSocietyProfileAction } from '@/app/(admin)/admin/society-profile/actions';
import { AppError } from '@/core/errors';
import {
  getActionPlans,
  getCapabilityAdoptions,
  getMeetingActionOptions,
  getSocietyProfile,
  getToolkitMemberOptions,
} from '@/core/toolkit/operations';
import { ActionPlansWorkspace } from './action-plans';
import { AdoptionScreen } from './adoption';
import { ToolkitRouteState } from './shared';
import { SocietyProfileScreen } from './society-profile';

export const TOOLKIT_PAGE_ROBOTS = { index: false, follow: false };
export const SOCIETY_PROFILE_HREF = '/admin/society-profile';
export const ADOPTION_HREF = '/admin/adoption';
export const ACTION_PLANS_HREF = '/admin/action-plans';

export function toolkitPageFailure(
  error: unknown,
  title: string,
  retryHref: string,
  returnHref = '/',
) {
  if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
    throw error;
  const denied = error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED';
  return (
    <ToolkitRouteState
      kind={denied ? 'denied' : 'error'}
      title={title}
      returnHref={returnHref}
      retryHref={denied ? undefined : retryHref}
      message={denied ? undefined : error.message}
      referenceId={error.referenceId}
    />
  );
}

/** Pickers are optional helpers; when they cannot load, the form still works without them. */
async function optionalList<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
      throw error;
    return [];
  }
}

export async function SocietyProfilePage() {
  let view;
  try {
    view = await getSocietyProfile();
  } catch (error) {
    return toolkitPageFailure(error, 'Society profile', SOCIETY_PROFILE_HREF);
  }
  return (
    <SocietyProfileScreen
      view={view}
      actions={{ saveProfile: saveSocietyProfileAction }}
    />
  );
}

export async function AdoptionPage() {
  let view;
  try {
    view = await getCapabilityAdoptions();
  } catch (error) {
    return toolkitPageFailure(error, 'Adoption tracker', ADOPTION_HREF);
  }
  const owners = view.can_manage
    ? await optionalList(getToolkitMemberOptions)
    : [];
  return (
    <AdoptionScreen
      view={view}
      owners={owners}
      actions={{ saveAdoption: saveCapabilityAdoptionAction }}
    />
  );
}

export async function ActionPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const showArchived = (await searchParams).archived === '1';
  let view;
  try {
    view = await getActionPlans(showArchived);
  } catch (error) {
    return toolkitPageFailure(
      error,
      'Action plans',
      showArchived ? `${ACTION_PLANS_HREF}?archived=1` : ACTION_PLANS_HREF,
    );
  }
  const [members, meetingActions] = view.can_manage
    ? await Promise.all([
        optionalList(getToolkitMemberOptions),
        optionalList(getMeetingActionOptions),
      ])
    : [[], []];
  return (
    <ActionPlansWorkspace
      view={view}
      members={members}
      meetingActions={meetingActions}
      showArchived={showArchived}
      archivedHref={`${ACTION_PLANS_HREF}?archived=1`}
      activeHref={ACTION_PLANS_HREF}
      actions={{
        savePlan: saveActionPlanAction,
        setPlanArchived: setActionPlanArchivedAction,
        createSamplePlan: createSampleActionPlanAction,
        saveTask: saveActionTaskAction,
        deleteTask: deleteActionTaskAction,
      }}
    />
  );
}
