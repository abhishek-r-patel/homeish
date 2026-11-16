// Run vendor and purchase-approval changes through audited operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { createVendorFileLink, prepareVendorUpload } from '@/core/vendor/files';
import {
  addPurchaseQuote,
  addVendorDocument,
  approvePurchaseRequest,
  archiveVendorDocument,
  cancelPurchaseRequest,
  overrideQuoteRule,
  rejectPurchaseRequest,
  removePurchaseQuote,
  retryPurchaseExpenseDraft,
  savePurchaseRequest,
  saveVendor,
  saveVendorRating,
  saveVendorSettings,
  selectPurchaseQuote,
  setVendorActive,
  submitPurchaseRequest,
} from '@/core/vendor/operations';
import { VENDOR_EXPENSE_DRAFT_LABELS } from '@/core/vendor/presentation';

const ROUTE = '/admin/vendors';

export async function prepareVendorDocumentUploadAction(form: FormData) {
  return runServerAction<{ path: string; signedUrl: string }>(
    ROUTE,
    async (requestId) => ({
      data: await prepareVendorUpload(
        readModuleActionInput(form),
        'document',
        requestId,
      ),
    }),
  );
}

export async function prepareVendorQuoteUploadAction(form: FormData) {
  return runServerAction<{ path: string; signedUrl: string }>(
    ROUTE,
    async (requestId) => ({
      data: await prepareVendorUpload(
        readModuleActionInput(form),
        'quote',
        requestId,
      ),
    }),
  );
}

export async function vendorFileLinkAction(form: FormData) {
  return runServerAction<{
    signedUrl: string;
    expiresIn: number;
    fileName: string;
  }>(ROUTE, async (requestId) => ({
    data: await createVendorFileLink(readModuleActionInput(form), requestId),
  }));
}

export async function saveVendorSettingsAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveVendorSettings(readModuleActionInput(form), requestId);
    return 'Settings saved. Requests already submitted keep the rule they were submitted under.';
  });
}

export async function saveVendorAction(form: FormData) {
  return runServerAction<string>(ROUTE, async (requestId) => ({
    data: await saveVendor(readModuleActionInput(form), requestId),
    message: 'Vendor saved.',
  }));
}

export async function setVendorActiveAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await setVendorActive(readModuleActionInput(form), requestId);
    return 'Vendor updated. Inactive vendors cannot receive new quotes.';
  });
}

export async function addVendorDocumentAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await addVendorDocument(readModuleActionInput(form), requestId);
    return 'Document attached privately.';
  });
}

export async function archiveVendorDocumentAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await archiveVendorDocument(readModuleActionInput(form), requestId);
    return 'Document archived. Nothing was deleted.';
  });
}

export async function saveVendorRatingAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveVendorRating(readModuleActionInput(form), requestId);
    return 'Rating saved. Only admins and committee members can see it.';
  });
}

export async function savePurchaseRequestAction(form: FormData) {
  return runServerAction<string>(ROUTE, async (requestId) => ({
    data: await savePurchaseRequest(readModuleActionInput(form), requestId),
    message: 'Purchase request saved as a draft.',
  }));
}

export async function addPurchaseQuoteAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await addPurchaseQuote(readModuleActionInput(form), requestId);
    return 'Quote added.';
  });
}

export async function removePurchaseQuoteAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await removePurchaseQuote(readModuleActionInput(form), requestId);
    return 'Quote removed.';
  });
}

export async function selectPurchaseQuoteAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await selectPurchaseQuote(readModuleActionInput(form), requestId);
    return 'Quote selected.';
  });
}

export async function overrideQuoteRuleAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await overrideQuoteRule(readModuleActionInput(form), requestId);
    return 'Quote rule override saved and recorded in the audit log.';
  });
}

export async function submitPurchaseRequestAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await submitPurchaseRequest(readModuleActionInput(form), requestId);
    return 'Submitted for approval. Approvers have been notified.';
  });
}

export async function approvePurchaseRequestAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    const result = await approvePurchaseRequest(
      readModuleActionInput(form),
      requestId,
    );
    if (result.status !== 'approved') {
      return `Approval recorded: ${result.approvals} of ${result.approvals_required}.`;
    }
    const draft = result.expense_draft_status
      ? ` ${VENDOR_EXPENSE_DRAFT_LABELS[result.expense_draft_status]}`
      : '';
    return `Request approved. The requester has been notified.${draft}`;
  });
}

export async function rejectPurchaseRequestAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await rejectPurchaseRequest(readModuleActionInput(form), requestId);
    return 'Request rejected. The requester has been notified.';
  });
}

export async function cancelPurchaseRequestAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await cancelPurchaseRequest(readModuleActionInput(form), requestId);
    return 'Request cancelled.';
  });
}

export async function retryPurchaseExpenseDraftAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    const status = await retryPurchaseExpenseDraft(
      readModuleActionInput(form),
      requestId,
    );
    return VENDOR_EXPENSE_DRAFT_LABELS[status];
  });
}
