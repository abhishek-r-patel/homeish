// Authorise Vendors & Purchases operations and validate their transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  vendorActiveInputSchema,
  vendorApproveResultSchema,
  vendorDetailSchema,
  vendorDocumentArchiveInputSchema,
  vendorDocumentInputSchema,
  vendorExpenseDraftStatusSchema,
  vendorInputSchema,
  vendorQuoteInputSchema,
  vendorQuoteOverrideInputSchema,
  vendorQuoteRemoveInputSchema,
  vendorQuoteSelectInputSchema,
  vendorRatingInputSchema,
  vendorRequestCancelInputSchema,
  vendorRequestDecisionInputSchema,
  vendorRequestDetailSchema,
  vendorRequestInputSchema,
  vendorRequestRejectInputSchema,
  vendorRequestSubmitInputSchema,
  vendorSettingsInputSchema,
  vendorWorkspaceSchema,
} from './validation';

export async function getVendorContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'vendor', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

export async function getVendorWorkspace() {
  const { context, societyId } = await getVendorContext('vendor:list');
  return callModuleRpc(
    context,
    'vendor_workspace_get',
    { p_society_id: societyId },
    vendorWorkspaceSchema,
    'Could not load vendors and purchases. Refresh and retry.',
  );
}

export async function getVendorDetail(vendorId: string) {
  const { context, societyId } = await getVendorContext('vendor:list');
  const id = parseModuleInput(z.uuid(), vendorId);
  return callModuleRpc(
    context,
    'vendor_get',
    { p_society_id: societyId, p_vendor_id: id },
    vendorDetailSchema,
    'Could not load this vendor. Refresh and retry.',
  );
}

export async function getPurchaseRequestDetail(purchaseRequestId: string) {
  const { context, societyId } = await getVendorContext('vendor:list');
  const id = parseModuleInput(z.uuid(), purchaseRequestId);
  return callModuleRpc(
    context,
    'vendor_request_get',
    { p_society_id: societyId, p_purchase_request_id: id },
    vendorRequestDetailSchema,
    'Could not load this purchase request. Refresh and retry.',
  );
}

export async function saveVendorSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorSettingsInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_settings_update',
    {
      p_society_id: societyId,
      p_quote_threshold_paise: values.quoteThresholdPaise,
      p_quotes_above_threshold: values.quotesAboveThreshold,
      p_approvals_required: values.approvalsRequired,
      p_request_id: context.requestId,
    },
    z.null(),
    'The settings were not saved. Use a threshold of ₹0 or more, 1 to 5 quotes and 0 to 5 approvals.',
  );
}

export async function saveVendor(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const vendor = parseModuleInput(vendorInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_save',
    {
      p_society_id: societyId,
      p_vendor_id: vendor.vendorId,
      p_name: vendor.name,
      p_category: vendor.category,
      p_contact_person: vendor.contactPerson,
      p_phone: vendor.phone,
      p_email: vendor.email,
      p_gstin: vendor.gstin,
      p_notes: vendor.notes,
      p_expected_version: vendor.expectedVersion,
      p_client_request_id: vendor.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The vendor was not saved. Check the phone, email and GSTIN, and use a name no other vendor uses.',
  );
}

export async function setVendorActive(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorActiveInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_set_active',
    {
      p_society_id: societyId,
      p_vendor_id: values.vendorId,
      p_active: values.active,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The vendor was not updated. Refresh and retry.',
  );
}

export async function addVendorDocument(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorDocumentInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_document_add',
    {
      p_society_id: societyId,
      p_vendor_id: values.vendorId,
      p_title: values.title,
      p_path: values.path,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The document was not attached. Upload a PDF, JPEG or PNG up to 5 MB and retry.',
  );
}

export async function archiveVendorDocument(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorDocumentArchiveInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_document_archive',
    {
      p_society_id: societyId,
      p_document_id: values.documentId,
      p_request_id: context.requestId,
    },
    z.null(),
    'The document was not archived. Refresh and retry.',
  );
}

export async function saveVendorRating(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:rate',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRatingInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_rating_save',
    {
      p_society_id: societyId,
      p_vendor_id: values.vendorId,
      p_stars: values.stars,
      p_comment: values.comment,
      p_request_id: context.requestId,
    },
    z.null(),
    'The rating was not saved. Choose 1 to 5 stars.',
  );
}

export async function savePurchaseRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:request',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRequestInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_request_save',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_title: values.title,
      p_description: values.description,
      p_category: values.category,
      p_estimated_amount_paise: values.estimatedAmountPaise,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The purchase request was not saved. Only a draft can be edited.',
  );
}

export async function addPurchaseQuote(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:request',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorQuoteInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_quote_add',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_vendor_id: values.vendorId,
      p_amount_paise: values.amountPaise,
      p_note: values.note,
      p_file_path: values.filePath,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The quote was not added. Quotes can change only while the request is a draft, and each vendor quotes once.',
  );
}

export async function removePurchaseQuote(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:request',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorQuoteRemoveInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_quote_remove',
    {
      p_society_id: societyId,
      p_quote_id: values.quoteId,
      p_request_id: context.requestId,
    },
    z.null(),
    'The quote was not removed. Quotes can change only while the request is a draft.',
  );
}

export async function selectPurchaseQuote(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:request',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorQuoteSelectInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_quote_select',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_quote_id: values.quoteId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The quote was not selected. Quotes can change only while the request is a draft.',
  );
}

export async function overrideQuoteRule(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorQuoteOverrideInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_quote_override',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_reason: values.reason,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The override was not saved. Give a reason of 5 to 500 characters while the request is a draft.',
  );
}

export async function submitPurchaseRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:request',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRequestSubmitInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_request_submit',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The request was not submitted. Select a quote and collect the quotes the rule needs first.',
  );
}

export async function approvePurchaseRequest(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    'vendor:approve',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRequestDecisionInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_request_approve',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_request_id: context.requestId,
    },
    vendorApproveResultSchema,
    'The request was not approved. Refresh and retry.',
  );
}

export async function rejectPurchaseRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:approve',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRequestRejectInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_request_reject',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    z.null(),
    'The request was not rejected. Give a reason of up to 500 characters.',
  );
}

export async function cancelPurchaseRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:request',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRequestCancelInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_request_cancel',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    z.null(),
    'The request was not cancelled. Refresh and retry.',
  );
}

export async function retryPurchaseExpenseDraft(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorRequestDecisionInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_expense_draft_retry',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_request_id: context.requestId,
    },
    vendorExpenseDraftStatusSchema,
    'The expense draft was not created. Refresh and retry.',
  );
}
