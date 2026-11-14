// Run authorized AMC contract, visit and service-request linkage mutations.
'use server';
import { runServerAction } from '@/core/actions/server-action';
import {
  saveAmcContract,
  saveAmcVisit,
  linkRequestToAmc,
} from '@/core/amc/operations';
import { ValidationError } from '@/core/errors';

function input(form: FormData): unknown {
  const raw = form.get('input');
  if (typeof raw !== 'string')
    throw new ValidationError({ form: 'Missing AMC details.' });
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError({ form: 'Invalid AMC details.' });
  }
}
export async function saveAmcContractAction(form: FormData) {
  return runServerAction('/admin/amc', async (id) => {
    await saveAmcContract(input(form), id);
    return 'AMC contract saved.';
  });
}
export async function saveAmcVisitAction(form: FormData) {
  return runServerAction('/admin/amc', async (id) => {
    await saveAmcVisit(input(form), id);
    return 'Service visit saved.';
  });
}
export async function linkAmcRequestAction(form: FormData) {
  return runServerAction('/admin/requests', async (id) => {
    await linkRequestToAmc(input(form), id);
    return 'AMC request link saved.';
  });
}
