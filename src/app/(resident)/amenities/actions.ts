// Run re-authorized amenity definition, booking and cancellation server actions.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import {
  recordAmenityActivity,
  overrideAmenityDeposit,
  recordAmenityDepositEvent,
  saveAmenity,
  saveAmenityCalendarVisibility,
  saveAmenityDepositPolicy,
  bookAmenity,
  cancelAmenity,
  voidAmenityDepositEvent,
} from '@/core/amenity/operations';
import { ValidationError } from '@/core/errors';
function input(form: FormData): unknown {
  const raw = form.get('input');
  if (typeof raw !== 'string')
    throw new ValidationError({ form: 'Missing amenity details.' });
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError({ form: 'Invalid amenity details.' });
  }
}
export async function saveAmenityAction(form: FormData) {
  return runServerAction('/admin/amenities', async (id) => {
    await saveAmenity(input(form), id);
    return 'Amenity and recurring slots saved.';
  });
}
export async function bookAmenityAction(form: FormData) {
  return runServerAction('/amenities', async (id) => {
    await bookAmenity(input(form), id);
    return 'Booking saved. A required deposit keeps the slot reserved until it is fully recorded.';
  });
}
export async function cancelAmenityAction(form: FormData) {
  return runServerAction('/amenities', async (id) => {
    await cancelAmenity(input(form), id);
    return 'Booking cancelled. Any booking fee has been fully credited to the unit ledger.';
  });
}

export async function saveAmenityCalendarVisibilityAction(form: FormData) {
  return runServerAction('/admin/settings', async (id) => {
    await saveAmenityCalendarVisibility(input(form), id);
    return 'Amenity calendar visibility saved.';
  });
}

export async function recordAmenityActivityAction(form: FormData) {
  return runServerAction<string>('/admin/amenities', async (id) => ({
    data: await recordAmenityActivity(input(form), id),
    message: 'Facility activity recorded.',
  }));
}

export async function saveAmenityDepositPolicyAction(form: FormData) {
  return runServerAction('/admin/settings', async (id) => {
    await saveAmenityDepositPolicy(input(form), id);
    return 'Amenity deposit confirmation policy saved.';
  });
}

export async function overrideAmenityDepositAction(form: FormData) {
  return runServerAction('/admin/amenities', async (id) => ({
    data: await overrideAmenityDeposit(input(form), id),
    message: 'Booking deposit amount changed with its reason recorded.',
  }));
}

export async function recordAmenityDepositEventAction(form: FormData) {
  return runServerAction('/admin/amenities', async (id) => ({
    data: await recordAmenityDepositEvent(input(form), id),
    message:
      'Deposit event recorded. No external payment or refund was initiated.',
  }));
}

export async function voidAmenityDepositEventAction(form: FormData) {
  return runServerAction('/admin/amenities', async (id) => ({
    data: await voidAmenityDepositEvent(input(form), id),
    message: 'Deposit event voided and correction history preserved.',
  }));
}
