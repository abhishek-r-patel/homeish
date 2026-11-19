// Save the society reference profile through the audited P35 operation.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { saveSocietyProfile } from '@/core/toolkit/operations';

const ROUTE = '/admin/society-profile';

export async function saveSocietyProfileAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveSocietyProfile(readModuleActionInput(form), requestId);
    return 'Society profile saved.';
  });
}
