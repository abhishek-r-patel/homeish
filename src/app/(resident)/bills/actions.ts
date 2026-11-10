// Resident billing mutations behind the standard server-action error boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { submitBillingPayment } from '@/core/billing/operations';

export async function submitBillingPaymentAction(formData: FormData) {
  return runServerAction('billing.payment.submit', async (requestId) => {
    const input = formData.get('input');
    let parsed: unknown = null;
    try {
      parsed = typeof input === 'string' ? JSON.parse(input) : null;
    } catch {
      parsed = null;
    }
    const result = await submitBillingPayment(parsed, requestId);
    revalidatePath('/bills');
    revalidatePath('/admin/billing');
    return {
      data: result,
      message:
        'Payment details submitted. The society will confirm after checking its account.',
    };
  });
}
