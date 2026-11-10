// Authorize and validate member administration at the server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { ValidationError } from '@/core/errors';
import {
  assignOccupant,
  approveSocietyRegistration,
  changeMemberRoles,
  confirmResidentsImport,
  deactivateMember,
  endOccupancy,
  inviteResident,
  moveOccupant,
  previewResidentsImport,
  rejectSocietyRegistration,
} from '@/core/members/operations';

export async function inviteResidentAction(formData: FormData) {
  return runServerAction('members.invite', async (requestId) => {
    await inviteResident(formData, requestId);
    revalidatePath('/admin/members');
    return 'Resident invited.';
  });
}

export async function changeMemberRolesAction(formData: FormData) {
  return runServerAction('members.changeRoles', async (requestId) => {
    await changeMemberRoles(formData, requestId);
    revalidatePath('/admin/members');
    return 'Member roles updated.';
  });
}

export async function deactivateMemberAction(formData: FormData) {
  return runServerAction('members.deactivate', async (requestId) => {
    await deactivateMember(formData, requestId);
    revalidatePath('/admin/members');
    return 'Member access deactivated.';
  });
}

export async function approveRegistrationAction(formData: FormData) {
  return runServerAction('members.approve', async (requestId) => {
    await approveSocietyRegistration(formData, requestId);
    revalidatePath('/admin/members');
    return 'Registration approved. Access is active.';
  });
}

export async function rejectRegistrationAction(formData: FormData) {
  return runServerAction('members.reject', async (requestId) => {
    await rejectSocietyRegistration(formData, requestId);
    revalidatePath('/admin/members');
    return 'Registration rejected. Access has been removed.';
  });
}

export async function assignOccupantAction(formData: FormData) {
  return runServerAction('members.unit.assign', async (requestId) => {
    await assignOccupant(formData, requestId);
    revalidatePath('/admin/members');
    return 'Resident assigned to the unit.';
  });
}

export async function moveOccupantAction(formData: FormData) {
  return runServerAction('members.unit.move', async (requestId) => {
    await moveOccupant(formData, requestId);
    revalidatePath('/admin/members');
    return 'Resident moved to the new unit.';
  });
}

export async function endOccupancyAction(formData: FormData) {
  return runServerAction('members.unit.end', async (requestId) => {
    await endOccupancy(formData, requestId);
    revalidatePath('/admin/members');
    return 'Unit occupancy ended.';
  });
}

export async function previewResidentsImportAction(csv: string) {
  return runServerAction('members.importPreview', async () => {
    if (typeof csv !== 'string') {
      throw new ValidationError({
        file: 'Choose a resident CSV file to preview.',
      });
    }
    return { data: await previewResidentsImport(csv) };
  });
}

export async function confirmResidentsImportAction(csv: string) {
  return runServerAction('members.importConfirm', async (requestId) => {
    if (typeof csv !== 'string') {
      throw new ValidationError({
        file: 'Choose a resident CSV file to import.',
      });
    }
    const jobId = await confirmResidentsImport(csv, requestId);
    revalidatePath('/admin/members');
    revalidatePath('/admin/jobs');
    return {
      message: 'Resident import complete. Review the job results.',
      data: jobId,
    };
  });
}
