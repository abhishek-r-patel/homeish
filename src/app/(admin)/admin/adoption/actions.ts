// Save capability adoption rows through the audited P35 operation.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { saveCapabilityAdoption } from '@/core/toolkit/operations';

const ROUTE = '/admin/adoption';

export async function saveCapabilityAdoptionAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveCapabilityAdoption(readModuleActionInput(form), requestId);
    return 'Adoption saved.';
  });
}
