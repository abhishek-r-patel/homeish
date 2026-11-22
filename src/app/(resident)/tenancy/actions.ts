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
  saveTenancyAgreementMetadata,
  saveTenancySettings,
  saveTenancyVerification,
} from '@/core/tenancy/moves/operations';
import {
  acknowledgeClearanceWarning,
  advanceTransferCase,
  approveClearanceHandover,
  attachClearanceFile,
  checkClearanceDues,
  consentClearanceHandover,
  draftClearanceHandover,
  issueTenancyCertificate,
  recordTransferDecision,
  saveTransferCase,
  supersedeTenancyCertificate,
} from '@/core/tenancy/transfers/operations';

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

export async function saveTenancyVerificationAction(form: FormData) {
  return runServerAction('/admin/tenancy', async (requestId) => {
    await saveTenancyVerification(readModuleActionInput(form), requestId);
    return 'Verification tracking saved.';
  });
}

export async function saveTenancyAgreementMetadataAction(form: FormData) {
  return runServerAction('/admin/tenancy', async (requestId) => {
    await saveTenancyAgreementMetadata(readModuleActionInput(form), requestId);
    return 'Agreement metadata saved.';
  });
}

export async function acknowledgeClearanceWarningAction(form: FormData) {
  return runServerAction('/admin/tenancy', async (requestId) => {
    await acknowledgeClearanceWarning(readModuleActionInput(form), requestId);
    return 'Clearance warning acknowledged for this society.';
  });
}

export async function saveTransferCaseAction(form: FormData) {
  return runServerAction<string>(
    '/admin/tenancy/transfers',
    async (requestId) => ({
      data: await saveTransferCase(readModuleActionInput(form), requestId),
      message: 'Transfer case saved. No Core ownership changed.',
    }),
  );
}

export async function advanceTransferCaseAction(form: FormData) {
  return runServerAction('/admin/tenancy/transfers', async (requestId) => {
    await advanceTransferCase(readModuleActionInput(form), requestId);
    return 'Transfer stage saved.';
  });
}

export async function recordTransferDecisionAction(form: FormData) {
  return runServerAction('/admin/tenancy/transfers', async (requestId) => {
    await recordTransferDecision(readModuleActionInput(form), requestId);
    return 'Committee decision saved.';
  });
}

export async function draftClearanceHandoverAction(form: FormData) {
  return runServerAction<string>(
    '/admin/tenancy/transfers',
    async (requestId) => ({
      data: await draftClearanceHandover(
        readModuleActionInput(form),
        requestId,
      ),
      message: 'Conditional handover drafted from the current dues check.',
    }),
  );
}

export async function approveClearanceHandoverAction(form: FormData) {
  return runServerAction('/admin/tenancy/transfers', async (requestId) => {
    await approveClearanceHandover(readModuleActionInput(form), requestId);
    return 'Conditional handover approved. Unit dues are unchanged.';
  });
}

export async function checkClearanceDuesAction(form: FormData) {
  return runServerAction('/admin/tenancy/transfers', async () => {
    const data = await checkClearanceDues(readModuleActionInput(form));
    return { data };
  });
}

export async function consentClearanceHandoverAction(form: FormData) {
  return runServerAction('/tenancy', async (requestId) => {
    await consentClearanceHandover(readModuleActionInput(form), requestId);
    return 'Handover consent recorded for this exact version.';
  });
}

export async function attachClearanceFileAction(form: FormData) {
  return runServerAction('/admin/tenancy/transfers', async (requestId) => {
    await attachClearanceFile(readModuleActionInput(form), requestId);
    return 'Private signed agreement attached to the draft handover.';
  });
}

export async function issueTenancyCertificateAction(form: FormData) {
  return runServerAction<string>(
    '/admin/tenancy/transfers',
    async (requestId) => ({
      data: await issueTenancyCertificate(
        readModuleActionInput(form),
        requestId,
      ),
      message: 'Numbered tenancy certificate issued.',
    }),
  );
}

export async function supersedeTenancyCertificateAction(form: FormData) {
  return runServerAction('/admin/tenancy/transfers', async (requestId) => {
    await supersedeTenancyCertificate(readModuleActionInput(form), requestId);
    return 'Certificate superseded. The original PDF remains unchanged.';
  });
}
