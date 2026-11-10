// Authorize billing setup and keep configuration changes atomic and validated.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import {
  isBillingPaymentProofPath,
  isBillingQrPath,
  SOCIETY_LOGO_CONTENT_TYPES,
  verifyFileAttachment,
} from '../files/attachments';
import { hasPermission } from '../permissions';
import { authorizeRequest } from '../permissions/authorize';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { sendBillingReceiptEmailPrivileged } from '../privileged';
import { buildRequestContext } from '../tenancy/request-context';
import { billingRpc as rpc, readBillingPaymentDetails } from './queries';
import {
  billingBillDetailsSchema,
  billingBillSchema,
  billingDashboardInputSchema,
  billingDashboardSchema,
  billingFineInputSchema,
  billingGenerationResultSchema,
  billingLedgerEntrySchema,
  billingPaymentConfirmInputSchema,
  billingPaymentDetailsSchema,
  billingPaymentRecordInputSchema,
  billingPaymentRejectInputSchema,
  billingPaymentSchema,
  billingPaymentSubmitInputSchema,
  billingPreviewInputSchema,
  billingPreviewSchema,
  billingReceiptSchema,
  billingReportExportInputSchema,
  billingReportJobSchema,
  billingSettingsUpdateInputSchema,
  billingSettingsSchema,
  billingWaiveInputSchema,
  chargeFormSchema,
  chargeTypeSchema,
  DEFAULT_BILLING_SETTINGS,
  exportJobSchema,
  paymentDetailsInputSchema,
  paymentDetailsSchema,
} from './validation';
import { formatRupees } from './format';

type BillingPermission =
  | 'billing:charges:read'
  | 'billing:charges:manage'
  | 'billing:settings:manage'
  | 'billing:bills:read'
  | 'billing:bills:manage'
  | 'billing:ledger:read'
  | 'billing:payments:read'
  | 'billing:payments:manage'
  | 'billing:payments:submit'
  | 'billing:payment_details:read'
  | 'billing:payment_details:manage';

async function getContext(
  permission: BillingPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'billing', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    Object.fromEntries(
      result.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

export async function getBillingPaymentDetails() {
  const { context, societyId } = await getContext(
    'billing:payment_details:read',
  );
  return readBillingPaymentDetails(context, societyId);
}

export async function getBillingSetup() {
  const { context, societyId } = await getContext('billing:charges:read');
  const [charges, paymentDetails, societyResult, settingsResult] =
    await Promise.all([
      rpc(
        context,
        'billing_charges_list',
        { p_society_id: societyId },
        z.array(chargeTypeSchema),
      ),
      readBillingPaymentDetails(context, societyId),
      context.db
        .from('societies')
        .select('timezone')
        .eq('id', societyId)
        .single(),
      context.db
        .from('module_configs')
        .select('settings,updated_at')
        .eq('society_id', societyId)
        .eq('module_key', 'billing')
        .single(),
    ]);
  if (societyResult.error || settingsResult.error) {
    throw new Error('The billing configuration could not be loaded.');
  }
  const canManage =
    context.societyStatus !== 'suspended' &&
    hasPermission(context.roles, 'billing', 'billing:charges:manage');
  let pendingQrPaths: string[] = [];
  if (canManage) {
    const directory = `${societyId}/billing-qr`;
    const { data: files, error } = await context.db.storage
      .from('society-assets')
      .list(directory, { limit: 3 });
    if (error) throw new Error('Unattached QR images could not be loaded.');
    pendingQrPaths = files
      .map((file) => `${directory}/${file.name}`)
      .filter(
        (path) =>
          path !== paymentDetails?.qr_path && isBillingQrPath(path, societyId),
      );
  }
  let qrUrl: string | null = null;
  if (paymentDetails?.qr_path) {
    const { data, error } = await context.db.storage
      .from('society-assets')
      .createSignedUrl(paymentDetails.qr_path, 300);
    if (error || !data)
      throw new Error('The society QR image could not be loaded.');
    qrUrl = data.signedUrl;
  }
  return {
    charges,
    paymentDetails,
    pendingQrPaths,
    qrUrl,
    societyId,
    timezone: societyResult.data.timezone,
    settings: {
      ...DEFAULT_BILLING_SETTINGS,
      ...billingSettingsSchema.parse(settingsResult.data.settings),
    },
    settingsUpdatedAt: settingsResult.data.updated_at,
    canManage,
    suspended: context.societyStatus === 'suspended',
  };
}

export async function updateBillingSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:settings:manage',
    true,
    requestId,
  );
  const settings = parseInput(billingSettingsUpdateInputSchema, input);
  return rpc(
    context,
    'billing_settings_update',
    {
      p_society_id: societyId,
      p_due_day: String(settings.dueDay),
      p_rounding: settings.rounding,
      p_expected_updated_at: settings.expectedUpdatedAt,
      p_request_id: context.requestId,
    },
    z.object({
      settings: billingSettingsSchema,
      updated_at: z.iso.datetime({ offset: true }),
    }),
  );
}

export async function saveBillingCharge(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:charges:manage',
    true,
    requestId,
  );
  const charge = parseInput(chargeFormSchema, input);
  return rpc(
    context,
    'billing_charge_save',
    {
      p_society_id: societyId,
      p_id: charge.id,
      p_name: charge.name,
      p_method: charge.method,
      p_amount_paise: charge.amountPaise,
      p_active: charge.active,
      p_expected_updated_at: charge.expectedUpdatedAt,
      p_request_id: context.requestId,
    },
    chargeTypeSchema,
  );
}

export async function previewBillingBills(input: unknown) {
  const { context, societyId } = await getContext('billing:bills:manage', true);
  const parsed = parseInput(billingPreviewInputSchema, input);
  return rpc(
    context,
    'billing_bills_preview',
    {
      p_society_id: societyId,
      p_period_start: parsed.period_start,
      p_unit_ids: parsed.unit_ids,
      p_charge_type_ids: parsed.charge_type_ids,
      p_custom_amounts: parsed.custom_amounts,
    },
    billingPreviewSchema,
  );
}

export async function getBillingGeneratorOptions() {
  const { context, societyId } = await getContext('billing:bills:manage', true);
  const [charges, unitsResult, settingsResult] = await Promise.all([
    rpc(
      context,
      'billing_charges_list',
      { p_society_id: societyId },
      z.array(chargeTypeSchema),
    ),
    context.db
      .from('units')
      .select('id,number,area_sqft')
      .eq('society_id', societyId)
      .eq('active', true)
      .order('number'),
    context.db
      .from('module_configs')
      .select('settings')
      .eq('society_id', societyId)
      .eq('module_key', 'billing')
      .single(),
  ]);
  if (unitsResult.error || settingsResult.error) {
    throw new Error('Billing generation options could not be loaded.');
  }
  const settings = {
    ...DEFAULT_BILLING_SETTINGS,
    ...billingSettingsSchema.parse(settingsResult.data.settings),
  };
  return {
    charges: charges.filter((charge) => charge.active),
    units: (unitsResult.data ?? []).map((unit) => ({
      id: unit.id,
      number: unit.number,
      areaSqft: unit.area_sqft === null ? null : String(unit.area_sqft),
    })),
    rounding: settings.rounding,
  };
}

export async function generateBillingBills(
  input: unknown,
  previewHash: string,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'billing:bills:manage',
    true,
    requestId,
  );
  const parsed = parseInput(billingPreviewInputSchema, input);
  const hash = parseInput(z.string().regex(/^[a-f0-9]{32}$/), previewHash);
  const result = await rpc(
    context,
    'billing_bills_generate',
    {
      p_society_id: societyId,
      p_period_start: parsed.period_start,
      p_unit_ids: parsed.unit_ids,
      p_charge_type_ids: parsed.charge_type_ids,
      p_custom_amounts: parsed.custom_amounts,
      p_preview_hash: hash,
      p_request_id: context.requestId,
    },
    billingGenerationResultSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  return result;
}

export async function listBillingBills(page: number, pageSize: number) {
  const { context, societyId } = await getContext('billing:bills:read');
  if (!Number.isInteger(page) || page < 1)
    throw new ValidationError({ page: 'Choose a valid bill page.' });
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new ValidationError({ pageSize: 'Choose a valid page size.' });
  return rpc(
    context,
    'billing_bills_list',
    {
      p_society_id: societyId,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    },
    z.array(billingBillSchema),
  );
}

export async function getBillingBill(billId: string) {
  const { context, societyId } = await getContext('billing:bills:read');
  const id = parseInput(z.uuid(), billId);
  return rpc(
    context,
    'billing_bill_get',
    { p_society_id: societyId, p_bill_id: id },
    billingBillDetailsSchema,
  );
}

export async function getBillingLedger(unitId: string) {
  const { context, societyId } = await getContext('billing:ledger:read');
  const id = parseInput(z.uuid(), unitId);
  return rpc(
    context,
    'billing_ledger_get',
    { p_society_id: societyId, p_unit_id: id },
    z.array(billingLedgerEntrySchema),
  );
}

export async function submitBillingPayment(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:payments:submit',
    true,
    requestId,
  );
  const parsed = parseInput(billingPaymentSubmitInputSchema, input);
  if (parsed.proof_path !== null) {
    if (
      !isBillingPaymentProofPath(parsed.proof_path, societyId, parsed.unit_id)
    ) {
      throw new ValidationError({
        proofPath: 'Choose a payment proof for this unit.',
      });
    }
    await verifyFileAttachment(context, {
      bucket: 'payment-proofs',
      contentTypes: ['image/jpeg', 'image/png'],
      ownerPath: `${societyId}/${parsed.unit_id}/payments`,
      path: parsed.proof_path,
      societyId,
    });
  }
  const result = await rpc(
    context,
    'billing_payment_submit',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unit_id,
      p_amount_paise: parsed.amount_paise,
      p_reference: parsed.reference,
      p_paid_on: parsed.paid_on,
      p_proof_path: parsed.proof_path,
      p_client_request_id: parsed.client_request_id,
      p_request_id: context.requestId,
    },
    billingPaymentSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  return result;
}

export async function confirmBillingPayment(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:payments:manage',
    true,
    requestId,
  );
  const parsed = parseInput(billingPaymentConfirmInputSchema, input);
  const result = await rpc(
    context,
    'billing_payment_confirm',
    {
      p_society_id: societyId,
      p_payment_id: parsed.payment_id,
      p_corrected_amount: parsed.corrected_amount_paise,
      p_request_id: context.requestId,
    },
    billingPaymentSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  await emailBillingReceipt(context, societyId, result.id);
  return result;
}

export async function rejectBillingPayment(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:payments:manage',
    true,
    requestId,
  );
  const parsed = parseInput(billingPaymentRejectInputSchema, input);
  const result = await rpc(
    context,
    'billing_payment_reject',
    {
      p_society_id: societyId,
      p_payment_id: parsed.payment_id,
      p_reason: parsed.reason,
      p_request_id: context.requestId,
    },
    billingPaymentSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  return result;
}

export async function recordBillingPayment(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:payments:manage',
    true,
    requestId,
  );
  const parsed = parseInput(billingPaymentRecordInputSchema, input);
  const result = await rpc(
    context,
    'billing_payment_record',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unit_id,
      p_amount_paise: parsed.amount_paise,
      p_mode: parsed.mode,
      p_reference: parsed.reference,
      p_paid_on: parsed.paid_on,
      p_client_request_id: parsed.client_request_id,
      p_request_id: context.requestId,
    },
    billingPaymentSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  await emailBillingReceipt(context, societyId, result.id);
  return result;
}

export async function listBillingPayments(
  page: number,
  pageSize: number,
  status?: 'awaiting_confirmation' | 'confirmed' | 'rejected',
) {
  const { context, societyId } = await getContext('billing:payments:read');
  if (!Number.isInteger(page) || page < 1)
    throw new ValidationError({ page: 'Choose a valid payment page.' });
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new ValidationError({ pageSize: 'Choose a valid page size.' });
  return rpc(
    context,
    'billing_payments_list',
    {
      p_society_id: societyId,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
      p_status: status ?? null,
    },
    z.array(billingPaymentSchema),
  );
}

export async function getBillingPayment(paymentId: string) {
  const { context, societyId } = await getContext('billing:payments:read');
  const id = parseInput(z.uuid(), paymentId);
  return rpc(
    context,
    'billing_payment_get',
    { p_society_id: societyId, p_payment_id: id },
    billingPaymentDetailsSchema,
  );
}

export async function updateBillingPaymentDetails(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'billing:payment_details:manage',
    true,
    requestId,
  );
  const details = parseInput(paymentDetailsInputSchema, input);
  if (details.qrPath !== null) {
    if (!isBillingQrPath(details.qrPath, societyId)) {
      throw new ValidationError({
        qrPath: 'Choose a QR image for this society.',
      });
    }
    await verifyFileAttachment(context, {
      bucket: 'society-assets',
      contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
      ownerPath: `${societyId}/billing-qr`,
      path: details.qrPath,
      societyId,
    });
  }
  const previous = await readBillingPaymentDetails(context, societyId);
  const changed =
    previous === null ||
    previous.upi_id !== details.upiId ||
    previous.payee_name !== details.payeeName ||
    previous.qr_path !== details.qrPath;
  const saved = await rpc(
    context,
    'billing_payment_details_update',
    {
      p_society_id: societyId,
      p_upi_id: details.upiId,
      p_payee_name: details.payeeName,
      p_qr_path: details.qrPath,
      p_expected_updated_at: details.expectedUpdatedAt,
      p_request_id: context.requestId,
    },
    paymentDetailsSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  let cleanupFailed = false;
  if (previous?.qr_path && previous.qr_path !== saved.qr_path) {
    try {
      const { error } = await context.db.storage
        .from('society-assets')
        .remove([previous.qr_path]);
      if (error) throw new Error('QR cleanup failed.');
    } catch {
      cleanupFailed = true;
      context.logger.warn('billing.qr_cleanup_failed');
    }
  }
  return {
    details: saved,
    message: cleanupFailed
      ? 'Payment details saved and the society team notified. The previous QR image could not be removed.'
      : changed
        ? 'Payment details saved and the society team notified.'
        : 'Payment details are unchanged. No new notifications were sent.',
  };
}

type BillingContext = Awaited<ReturnType<typeof getContext>>['context'];

const billingBillMutationSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  kind: z.enum(['regular', 'fine', 'late_fee']),
  title: z.string(),
  outstanding_paise: z.number().int().nonnegative(),
});

async function readBillingReceipt(
  context: BillingContext,
  societyId: string,
  paymentId: string,
) {
  return rpc(
    context,
    'billing_receipt_get',
    { p_society_id: societyId, p_payment_id: paymentId },
    billingReceiptSchema,
  );
}

async function emailBillingReceipt(
  context: BillingContext,
  societyId: string,
  paymentId: string,
) {
  try {
    const receipt = await readBillingReceipt(context, societyId, paymentId);
    const lines = [
      `Payment received for ${receipt.unit_label} ${receipt.unit_number}, ${receipt.society_name}.`,
      '',
      `Receipt number: ${receipt.receipt_no}`,
      `Amount: ${formatRupees(receipt.amount_paise)}`,
      `Paid on: ${receipt.paid_on}`,
      ...(receipt.allocations.length > 0
        ? [
            '',
            'Applied to:',
            ...receipt.allocations.map(
              (item) => `- ${item.title}: ${formatRupees(item.amount_paise)}`,
            ),
          ]
        : []),
      '',
      'Download the PDF receipt from Billing > Receipts in Homeish.',
    ];
    await sendBillingReceiptEmailPrivileged({
      societyId,
      paymentId,
      subject: `Payment receipt ${receipt.receipt_no}`,
      textContent: lines.join('\n'),
    });
  } catch {
    context.logger.warn('billing.receipt_email_failed');
  }
}

export async function addBillingFine(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:bills:manage',
    true,
    requestId,
  );
  const parsed = parseInput(billingFineInputSchema, input);
  const result = await rpc(
    context,
    'billing_fine_add',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unit_id,
      p_amount_paise: parsed.amount_paise,
      p_reason: parsed.reason,
      p_fine_date: parsed.fine_date,
      p_request_id: context.requestId,
    },
    billingBillMutationSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  return result;
}

export async function waiveBillingBill(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:bills:manage',
    true,
    requestId,
  );
  const parsed = parseInput(billingWaiveInputSchema, input);
  const result = await rpc(
    context,
    'billing_bill_waive',
    {
      p_society_id: societyId,
      p_bill_id: parsed.bill_id,
      p_amount_paise: parsed.amount_paise,
      p_reason: parsed.reason,
      p_cancel: parsed.cancel,
      p_request_id: context.requestId,
    },
    billingBillMutationSchema,
  );
  await sendNotificationPushesForRequest(context.requestId);
  return result;
}

export async function getBillingDashboard(input: unknown) {
  const { context, societyId } = await getContext('billing:charges:read');
  const range = parseInput(billingDashboardInputSchema, input);
  return rpc(
    context,
    'billing_dashboard',
    { p_society_id: societyId, p_from: range.from, p_to: range.to },
    billingDashboardSchema,
  );
}

export async function exportBillingReport(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'billing:charges:read',
    false,
    requestId,
  );
  const parsed = parseInput(billingReportExportInputSchema, input);
  return rpc(
    context,
    'billing_report_export',
    {
      p_society_id: societyId,
      p_report: parsed.report,
      p_from: parsed.from,
      p_to: parsed.to,
      p_request_id: context.requestId,
    },
    billingReportJobSchema,
  );
}

export async function getExportJob(jobId: string) {
  const { context } = await getContext('billing:charges:read');
  const id = parseInput(z.uuid(), jobId);
  return rpc(context, 'export_job_get', { p_job_id: id }, exportJobSchema);
}

export async function getBillingReceipt(paymentId: string) {
  const { context, societyId } = await getContext('billing:payments:read');
  const id = parseInput(z.uuid(), paymentId);
  return readBillingReceipt(context, societyId, id);
}

export async function listBillingUnits() {
  const { context, societyId } = await getContext('billing:bills:read');
  const { data, error } = await context.db
    .from('units')
    .select('id, number')
    .eq('society_id', societyId)
    .eq('active', true)
    .order('number');
  if (error) throw new Error('Units could not be loaded.', { cause: error });
  return data;
}

export async function getResidentBilling() {
  const { context, societyId } = await getContext('billing:bills:read');
  if (!context.roles.includes('resident')) throw new AppError('FORBIDDEN');
  const { data: membership, error: membershipError } = await context.db
    .from('memberships')
    .select('id')
    .eq('society_id', societyId)
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .single();
  if (membershipError) {
    throw new Error('Membership could not be loaded.', {
      cause: membershipError,
    });
  }
  const { data: occupants, error: occupantError } = await context.db
    .from('unit_occupants')
    .select('unit_id, units!inner(number)')
    .eq('society_id', societyId)
    .eq('membership_id', membership.id)
    .eq('status', 'active');
  if (occupantError) {
    throw new Error('Occupied units could not be loaded.', {
      cause: occupantError,
    });
  }
  const units = [
    ...new Map(
      occupants.map((item) => [
        item.unit_id,
        { id: item.unit_id, number: item.units.number },
      ]),
    ).values(),
  ].sort((left, right) => left.number.localeCompare(right.number));
  const unitIds = new Set(units.map((unit) => unit.id));
  const [bills, payments, ledgers, paymentDetails, society] = await Promise.all(
    [
      rpc(
        context,
        'billing_bills_list',
        { p_society_id: societyId, p_limit: 100, p_offset: 0 },
        z.array(billingBillSchema),
      ),
      rpc(
        context,
        'billing_payments_list',
        {
          p_society_id: societyId,
          p_limit: 100,
          p_offset: 0,
          p_status: null,
        },
        z.array(billingPaymentSchema),
      ),
      Promise.all(
        units.map(async (unit) => ({
          unitId: unit.id,
          entries: await rpc(
            context,
            'billing_ledger_get',
            { p_society_id: societyId, p_unit_id: unit.id },
            z.array(billingLedgerEntrySchema),
          ),
        })),
      ),
      readBillingPaymentDetails(context, societyId),
      context.db
        .from('societies')
        .select('timezone, unit_label')
        .eq('id', societyId)
        .single(),
    ],
  );
  if (society.error) {
    throw new Error('Society details could not be loaded.', {
      cause: society.error,
    });
  }
  let qrUrl: string | null = null;
  if (paymentDetails?.qr_path) {
    const { data, error } = await context.db.storage
      .from('society-assets')
      .createSignedUrl(paymentDetails.qr_path, 300);
    if (error || !data) context.logger.warn('billing.qr_view_failed');
    else qrUrl = data.signedUrl;
  }
  return {
    units,
    bills: bills.filter((bill) => unitIds.has(bill.unit_id)),
    payments: payments.filter((payment) => unitIds.has(payment.unit_id)),
    ledgers,
    paymentDetails,
    qrUrl,
    timezone: society.data.timezone,
    unitLabel: society.data.unit_label,
    suspended: context.societyStatus === 'suspended',
  };
}

export async function getBillingAdminContext() {
  const { context, societyId } = await getContext('billing:charges:read');
  const [society, config] = await Promise.all([
    context.db
      .from('societies')
      .select('timezone, unit_label')
      .eq('id', societyId)
      .single(),
    context.db
      .from('module_configs')
      .select('settings')
      .eq('society_id', societyId)
      .eq('module_key', 'billing')
      .single(),
  ]);
  if (society.error || config.error) {
    throw new Error('The billing configuration could not be loaded.');
  }
  const suspended = context.societyStatus === 'suspended';
  return {
    canManage:
      !suspended &&
      hasPermission(context.roles, 'billing', 'billing:bills:manage'),
    suspended,
    timezone: society.data.timezone,
    unitLabel: society.data.unit_label,
    settings: {
      ...DEFAULT_BILLING_SETTINGS,
      ...billingSettingsSchema.parse(config.data.settings),
    },
  };
}
