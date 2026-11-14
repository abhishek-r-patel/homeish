// Record staff entry and exit through validated, audited server operations.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  checkInDomesticStaff,
  checkOutDomesticStaff,
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

export async function checkInDomesticStaffAction(formData: FormData) {
  return runServerAction('staff.checkIn', async (requestId) => {
    await checkInDomesticStaff(parseInput(formData), requestId);
    revalidatePath('/guard/staff');
    revalidatePath('/staff');
    revalidatePath('/admin/staff');
    return 'Staff entry recorded.';
  });
}

export async function checkOutDomesticStaffAction(formData: FormData) {
  return runServerAction('staff.checkOut', async (requestId) => {
    await checkOutDomesticStaff(parseInput(formData), requestId);
    revalidatePath('/guard/staff');
    revalidatePath('/staff');
    revalidatePath('/admin/staff');
    return 'Staff exit recorded.';
  });
}
