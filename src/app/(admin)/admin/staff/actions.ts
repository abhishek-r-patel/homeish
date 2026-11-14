// Handle administrator staff, approval, setting and shift mutations.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  markSocietyStaffShift,
  reviewStaffRegistration,
  saveStaff,
  updateStaffSettings,
} from '@/core/staff/operations';

function parseInput(formData: FormData): unknown {
  const raw = formData.get('input');
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function refreshStaff() {
  revalidatePath('/admin/staff');
  revalidatePath('/staff');
  revalidatePath('/guard/staff');
}

export async function saveStaffAction(formData: FormData) {
  return runServerAction('staff.save', async (requestId) => {
    const staffId = await saveStaff(parseInput(formData), requestId);
    refreshStaff();
    return { data: staffId, message: 'Staff details saved.' };
  });
}

export async function reviewStaffRegistrationAction(formData: FormData) {
  return runServerAction('staff.review', async (requestId) => {
    await reviewStaffRegistration(parseInput(formData), requestId);
    refreshStaff();
    return 'Staff registration reviewed.';
  });
}

export async function updateStaffSettingsAction(formData: FormData) {
  return runServerAction('staff.updateSettings', async (requestId) => {
    await updateStaffSettings(parseInput(formData), requestId);
    revalidatePath('/admin/staff');
    return 'Staff registration settings saved.';
  });
}

export async function markSocietyStaffShiftAction(formData: FormData) {
  return runServerAction('staff.markShift', async (requestId) => {
    await markSocietyStaffShift(parseInput(formData), requestId);
    revalidatePath('/admin/staff');
    return 'Society staff attendance saved.';
  });
}
