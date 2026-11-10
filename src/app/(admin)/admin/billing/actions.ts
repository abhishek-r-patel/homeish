// Keep billing setup mutations behind the standard server-action error boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  addBillingFine,
  confirmBillingPayment,
  exportBillingReport,
  generateBillingBills,
  recordBillingPayment,
  previewBillingBills,
  rejectBillingPayment,
  saveBillingCharge,
  updateBillingSettings,
  updateBillingPaymentDetails,
  waiveBillingBill,
} from '@/core/billing/operations';

function value(formData: FormData, key: string): string {
  const input = formData.get(key);
  return typeof input === 'string' ? input : '';
}

function jsonValue(formData: FormData, key: string): unknown {
  try {
    return JSON.parse(value(formData, key));
  } catch {
    return null;
  }
}

export async function confirmBillingPaymentAction(formData: FormData) {
  return runServerAction('billing.payment.confirm', async (requestId) => {
    const result = await confirmBillingPayment(
      jsonValue(formData, 'input'),
      requestId,
    );
    revalidatePath('/admin/billing');
    revalidatePath('/bills');
    return { data: result, message: 'Payment confirmed and receipt issued.' };
  });
}

export async function rejectBillingPaymentAction(formData: FormData) {
  return runServerAction('billing.payment.reject', async (requestId) => {
    const result = await rejectBillingPayment(
      jsonValue(formData, 'input'),
      requestId,
    );
    revalidatePath('/admin/billing');
    revalidatePath('/bills');
    return { data: result, message: 'Payment rejected and resident notified.' };
  });
}

export async function recordBillingPaymentAction(formData: FormData) {
  return runServerAction('billing.payment.record', async (requestId) => {
    const result = await recordBillingPayment(
      jsonValue(formData, 'input'),
      requestId,
    );
    revalidatePath('/admin/billing');
    revalidatePath('/bills');
    return { data: result, message: 'Payment recorded and receipt issued.' };
  });
}

export async function updateBillingSettingsAction(formData: FormData) {
  return runServerAction('billing.settings.update', async (requestId) => {
    const result = await updateBillingSettings(
      {
        dueDay: value(formData, 'dueDay'),
        rounding: value(formData, 'rounding'),
        expectedUpdatedAt: value(formData, 'expectedUpdatedAt'),
      },
      requestId,
    );
    revalidatePath('/admin/billing');
    return { data: result, message: 'Society billing preferences saved.' };
  });
}

export async function previewBillingBillsAction(formData: FormData) {
  return runServerAction('billing.bills.preview', async () => {
    const result = await previewBillingBills(jsonValue(formData, 'input'));
    return { data: result };
  });
}

export async function generateBillingBillsAction(formData: FormData) {
  return runServerAction('billing.bills.generate', async (requestId) => {
    const result = await generateBillingBills(
      jsonValue(formData, 'input'),
      value(formData, 'previewHash'),
      requestId,
    );
    revalidatePath('/admin/billing');
    return {
      data: result,
      message:
        result.generated_bill_count === 0
          ? 'No new bills were generated. The selected charges are already on bills for this period.'
          : `${result.generated_bill_count} bill${result.generated_bill_count === 1 ? '' : 's'} generated.`,
    };
  });
}

export async function saveBillingChargeAction(formData: FormData) {
  return runServerAction('billing.charges.save', async (requestId) => {
    const charge = await saveBillingCharge(
      {
        id: value(formData, 'id') || null,
        name: value(formData, 'name'),
        method: value(formData, 'method'),
        amountRupees: value(formData, 'amountRupees'),
        active: value(formData, 'active') === 'true',
        expectedUpdatedAt: value(formData, 'expectedUpdatedAt') || null,
      },
      requestId,
    );
    revalidatePath('/admin/billing');
    return { data: charge, message: 'Charge type saved.' };
  });
}

export async function updateBillingPaymentDetailsAction(formData: FormData) {
  return runServerAction('billing.paymentDetails.update', async (requestId) => {
    const result = await updateBillingPaymentDetails(
      {
        upiId: value(formData, 'upiId'),
        payeeName: value(formData, 'payeeName'),
        qrPath: value(formData, 'qrPath') || null,
        expectedUpdatedAt: value(formData, 'expectedUpdatedAt') || null,
      },
      requestId,
    );
    revalidatePath('/admin/billing');
    return { data: result.details, message: result.message };
  });
}

export async function addBillingFineAction(formData: FormData) {
  return runServerAction('billing.fine.add', async (requestId) => {
    const result = await addBillingFine(
      {
        unitId: value(formData, 'unitId'),
        amountRupees: value(formData, 'amountRupees'),
        reason: value(formData, 'reason'),
        fineDate: value(formData, 'fineDate'),
      },
      requestId,
    );
    revalidatePath('/admin/billing');
    revalidatePath('/bills');
    return { data: result, message: 'Fine added and residents notified.' };
  });
}

export async function waiveBillingBillAction(formData: FormData) {
  return runServerAction('billing.bill.waive', async (requestId) => {
    const cancel = value(formData, 'cancel') === 'true';
    const result = await waiveBillingBill(
      {
        billId: value(formData, 'billId'),
        amountRupees: value(formData, 'amountRupees'),
        reason: value(formData, 'reason'),
        cancel,
      },
      requestId,
    );
    revalidatePath('/admin/billing');
    revalidatePath('/bills');
    return {
      data: result,
      message: cancel ? 'Bill cancelled.' : 'Waiver applied.',
    };
  });
}

export async function exportBillingReportAction(formData: FormData) {
  return runServerAction('billing.reports.export', async (requestId) => {
    const result = await exportBillingReport(
      {
        report: value(formData, 'report'),
        from: value(formData, 'from'),
        to: value(formData, 'to'),
      },
      requestId,
    );
    return {
      data: result,
      message: `Export ready with ${result.row_count} row${result.row_count === 1 ? '' : 's'}.`,
    };
  });
}
