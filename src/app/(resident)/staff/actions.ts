// Handle resident staff registration and unit-scoped day blocks.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  blockStaffForToday,
  registerDomesticStaff,
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

export async function registerDomesticStaffAction(formData: FormData) {
  return runServerAction('staff.registerDomestic', async (requestId) => {
    const result = await registerDomesticStaff(parseInput(formData), requestId);
    revalidatePath('/staff');
    revalidatePath('/admin/staff');
    revalidatePath('/guard/staff');
    return {
      data: result,
      message: result.message,
    };
  });
}

export async function blockStaffForTodayAction(formData: FormData) {
  return runServerAction('staff.blockToday', async (requestId) => {
    await blockStaffForToday(parseInput(formData), requestId);
    revalidatePath('/staff');
    revalidatePath('/guard/staff');
    return 'This staff member is blocked at your unit for today.';
  });
}
