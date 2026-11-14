// Run re-authorized amenity definition, booking and cancellation server actions.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import {
  saveAmenity,
  bookAmenity,
  cancelAmenity,
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
    return 'Booking confirmed. Any fee has been charged to your unit ledger.';
  });
}
export async function cancelAmenityAction(form: FormData) {
  return runServerAction('/amenities', async (id) => {
    await cancelAmenity(input(form), id);
    return 'Booking cancelled. Any booking fee has been fully credited to the unit ledger.';
  });
}
