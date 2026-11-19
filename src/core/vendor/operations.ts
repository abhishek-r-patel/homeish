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
  vendorBillCancelInputSchema,
  vendorBillInputSchema,
  vendorBillPaymentLinkInputSchema,
  vendorBillPaymentUnlinkInputSchema,
  vendorBillsSchema,
  vendorBlacklistInputSchema,
  vendorContractInputSchema,
  vendorContractRenewInputSchema,
  vendorContractTerminateInputSchema,
  vendorContractsSchema,
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
  vendorStaffDayCheckInputSchema,
  vendorStaffDayChecksSchema,
  vendorSummarySchema,
  vendorWorkOrderCreateInputSchema,
  vendorWorkOrderStatusInputSchema,
  vendorWorkOrderUpdateInputSchema,
  vendorWorkOrdersSchema,
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
      p_pan: vendor.pan,
      p_payment_terms_days: vendor.paymentTermsDays,
      p_onboarded_date: vendor.onboardedDate,
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

export async function setVendorBlacklisted(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorBlacklistInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_set_blacklisted',
    {
      p_society_id: societyId,
      p_vendor_id: values.vendorId,
      p_blacklisted: values.blacklisted,
      p_expected_version: values.expectedVersion,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    z.null(),
    'The blacklist status was not updated. Enter a reason and refresh the vendor before retrying.',
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

export type VendorRegisterScope = { vendorId?: string };

function registerArgs(societyId: string, scope: VendorRegisterScope) {
  return scope.vendorId
    ? {
        p_society_id: societyId,
        p_vendor_id: parseModuleInput(z.uuid(), scope.vendorId),
      }
    : { p_society_id: societyId };
}

export async function getVendorContracts(scope: VendorRegisterScope = {}) {
  const { context, societyId } = await getVendorContext('vendor:list');
  return callModuleRpc(
    context,
    'vendor_contracts_get',
    registerArgs(societyId, scope),
    vendorContractsSchema,
    'Could not load contracts. Refresh and retry.',
  );
}

export async function getVendorStaffDayChecks(scope: VendorRegisterScope = {}) {
  const { context, societyId } = await getVendorContext('vendor:list');
  return callModuleRpc(
    context,
    'vendor_staff_day_checks_get',
    registerArgs(societyId, scope),
    vendorStaffDayChecksSchema,
    'Could not load agency checks. Refresh and retry.',
  );
}

export async function getVendorWorkOrders(scope: VendorRegisterScope = {}) {
  const { context, societyId } = await getVendorContext('vendor:list');
  return callModuleRpc(
    context,
    'vendor_work_orders_get',
    registerArgs(societyId, scope),
    vendorWorkOrdersSchema,
    'Could not load work orders. Refresh and retry.',
  );
}

export async function getVendorBills(scope: VendorRegisterScope = {}) {
  const { context, societyId } = await getVendorContext('vendor:list');
  return callModuleRpc(
    context,
    'vendor_bills_get',
    registerArgs(societyId, scope),
    vendorBillsSchema,
    'Could not load bills owed. Refresh and retry.',
  );
}

export async function getVendorSummary(scope: VendorRegisterScope = {}) {
  const { context, societyId } = await getVendorContext('vendor:list');
  return callModuleRpc(
    context,
    'vendor_summary_get',
    registerArgs(societyId, scope),
    vendorSummarySchema,
    'Could not load the vendor summary. Refresh and retry.',
  );
}

const CONTRACT_FAILURE =
  'The contract was not saved. Check the period, annual value, payment frequency and notice days.';

export async function saveVendorContract(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorContractInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_contract_save',
    {
      p_society_id: societyId,
      p_contract_id: values.contractId,
      p_vendor_id: values.vendorId,
      p_scope: values.scope,
      p_start_date: values.startDate,
      p_end_date: values.endDate,
      p_annual_value_paise: values.annualValuePaise,
      p_payment_frequency: values.paymentFrequency,
      p_auto_renew: values.autoRenew,
      p_notice_days: values.noticeDays,
      p_document_path: values.documentPath,
      p_default_sanctioned_days: values.defaultSanctionedDays,
      p_deduction_per_day_paise: values.deductionPerDayPaise,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    CONTRACT_FAILURE,
  );
}

export async function renewVendorContract(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorContractRenewInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_contract_renew',
    {
      p_society_id: societyId,
      p_predecessor_id: values.predecessorId,
      p_scope: values.scope,
      p_start_date: values.startDate,
      p_end_date: values.endDate,
      p_annual_value_paise: values.annualValuePaise,
      p_payment_frequency: values.paymentFrequency,
      p_auto_renew: values.autoRenew,
      p_notice_days: values.noticeDays,
      p_document_path: values.documentPath,
      p_default_sanctioned_days: values.defaultSanctionedDays,
      p_deduction_per_day_paise: values.deductionPerDayPaise,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The renewal was not saved. A terminated contract cannot be renewed; check the new period and terms.',
  );
}

export async function terminateVendorContract(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorContractTerminateInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_contract_terminate',
    {
      p_society_id: societyId,
      p_contract_id: values.contractId,
      p_terminated_on: values.terminatedOn,
      p_reason: values.reason,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The contract was not ended. Choose a date within the contract period and enter a reason.',
  );
}

export async function saveVendorStaffDayCheck(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorStaffDayCheckInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_staff_day_check_save',
    {
      p_society_id: societyId,
      p_check_id: values.checkId,
      p_contract_id: values.contractId,
      p_month: values.month,
      p_sanctioned_days: values.sanctionedDays,
      p_actual_days: values.actualDays,
      p_contracted_amount_paise: values.contractedAmountPaise,
      p_rate_paise: values.ratePaise,
      p_manual_deduction_paise: values.manualDeductionPaise,
      p_manual_deduction_reason: values.manualDeductionReason,
      p_bill_raised_paise: values.billRaisedPaise,
      p_edit_reason: values.editReason,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The agency check was not saved. The month must fall within the contract period, and sanctioned days must be 1 to 31.',
  );
}

export async function createVendorWorkOrder(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorWorkOrderCreateInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_work_order_create',
    {
      p_society_id: societyId,
      p_purchase_request_id: values.purchaseRequestId,
      p_description: values.description,
      p_value_paise: values.valuePaise,
      p_issued_on: values.issuedOn,
      p_due_on: values.dueOn,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The work order was not issued. Only an approved purchase request can get one, and the due date must be on or after the issue date.',
  );
}

export async function updateVendorWorkOrder(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorWorkOrderUpdateInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_work_order_update',
    {
      p_society_id: societyId,
      p_work_order_id: values.workOrderId,
      p_description: values.description,
      p_due_on: values.dueOn,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The work order was not saved. Only an open work order can be edited, and the due date must be on or after the issue date.',
  );
}

export async function setVendorWorkOrderStatus(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorWorkOrderStatusInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_work_order_set_status',
    {
      p_society_id: societyId,
      p_work_order_id: values.workOrderId,
      p_status: values.status,
      p_completed_on: values.status === 'completed' ? values.completedOn : null,
      p_reason: values.status === 'cancelled' ? values.reason : null,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The status was not changed. Status only moves forward; a completion date must be between the issue date and today.',
  );
}

export async function saveVendorBill(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorBillInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_bill_save',
    {
      p_society_id: societyId,
      p_bill_id: values.billId,
      p_vendor_id: values.vendorId,
      p_invoice_number: values.invoiceNumber,
      p_invoice_date: values.invoiceDate,
      p_amount_paise: values.amountPaise,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The bill was not saved. A bill with a counted payment or a cancelled bill cannot be edited.',
  );
}

export async function cancelVendorBill(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorBillCancelInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_bill_cancel',
    {
      p_society_id: societyId,
      p_bill_id: values.billId,
      p_reason: values.reason,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The bill was not cancelled. A bill with a counted payment cannot be cancelled.',
  );
}

export async function linkVendorBillPayment(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorBillPaymentLinkInputSchema, input);
  return callModuleRpc(
    context,
    'vendor_bill_payment_link',
    {
      p_society_id: societyId,
      p_bill_id: values.billId,
      p_entry_id: values.entryId,
      p_amount_paise: values.amountPaise,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    "The payment was not linked. The amount cannot exceed the bill's balance or the entry's unlinked amount.",
  );
}

export async function unlinkVendorBillPayment(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    'vendor:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(vendorBillPaymentUnlinkInputSchema, input);
  await callModuleRpc(
    context,
    'vendor_bill_payment_unlink',
    {
      p_society_id: societyId,
      p_payment_id: values.paymentId,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    z.null(),
    'The payment was not unlinked. Refresh and retry.',
  );
}
