// Run tenancy mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  attachTenancyDocument,
  completeTenancyMove,
  consentTenancyMove,
  createTenancyMove,
  decideTenancyMove,
  issueTenancyNoc,
  saveTenancySettings,
} from '@/core/tenancy/moves/operations';

export async function createTenancyAction(form: FormData) {
  return runServerAction<string>('/tenancy', async (requestId) => ({
    data: await createTenancyMove(readModuleActionInput(form), requestId),
    message: 'Move request created. Attach the required proofs next.',
  }));
}

export async function attachTenancyProofAction(form: FormData) {
  return runServerAction('/tenancy', async (requestId) => {
    await attachTenancyDocument(readModuleActionInput(form), requestId);
    return 'Private proof attached to the request.';
  });
}

export async function consentTenancyAction(form: FormData) {
  return runServerAction('/tenancy', async (requestId) => {
    await consentTenancyMove(readModuleActionInput(form), requestId);
    return 'Owner consent recorded. An administrator must review the schedule.';
  });
}

export async function decideTenancyAction(form: FormData) {
  return runServerAction('/tenancy', async (requestId) => {
    await decideTenancyMove(readModuleActionInput(form), requestId);
    return 'Move decision saved.';
  });
}

export async function completeTenancyAction(form: FormData) {
  return runServerAction('/admin/tenancy', async (requestId) => {
    await completeTenancyMove(readModuleActionInput(form), requestId);
    return 'Actual move completed and household access updated.';
  });
}

export async function issueTenancyNocAction(form: FormData) {
  return runServerAction('/admin/tenancy', async (requestId) => {
    await issueTenancyNoc(readModuleActionInput(form), requestId);
    return 'Move-out NOC issued. Open it from the private documents.';
  });
}

export async function saveTenancySettingsAction(form: FormData) {
  return runServerAction('/admin/tenancy', async (requestId) => {
    await saveTenancySettings(readModuleActionInput(form), requestId);
    return 'Tenant proof requirement saved.';
  });
}
