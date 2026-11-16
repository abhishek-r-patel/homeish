// Run Utility Metering mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  recordMeteringReading,
  reviewMeteringReading,
  runMeteringBilling,
  saveMeteringMeter,
  setMeteringRate,
  submitMeteringReading,
} from '@/core/metering/operations';
import type { MeteringBillingResult } from '@/core/metering/validation';
import { formatMeteringPaise } from '@/core/metering/presentation';

export async function saveMeteringMeterAction(form: FormData) {
  return runServerAction<string>('/admin/metering', async (requestId) => ({
    data: await saveMeteringMeter(readModuleActionInput(form), requestId),
    message: 'Meter saved.',
  }));
}

export async function setMeteringRateAction(form: FormData) {
  return runServerAction('/admin/metering', async (requestId) => {
    await setMeteringRate(readModuleActionInput(form), requestId);
    return 'Rate saved. It applies to readings not yet billed.';
  });
}

export async function reviewMeteringReadingAction(form: FormData) {
  return runServerAction('/admin/metering', async (requestId) => {
    const input = readModuleActionInput(form);
    await reviewMeteringReading(input, requestId);
    return typeof input === 'object' &&
      input !== null &&
      'decision' in input &&
      input.decision === 'reject'
      ? 'Reading rejected. The resident has been told why.'
      : 'Reading approved.';
  });
}

export async function runMeteringBillingAction(form: FormData) {
  return runServerAction<MeteringBillingResult>(
    '/admin/metering',
    async (requestId) => {
      const result = await runMeteringBilling(
        readModuleActionInput(form),
        requestId,
      );
      const parts = [
        `${result.charges_billed} charge${result.charges_billed === 1 ? '' : 's'} added to ${result.bills_created} bill${result.bills_created === 1 ? '' : 's'} (${formatMeteringPaise(result.billed_paise)}).`,
      ];
      if (result.charges_without_rate > 0)
        parts.push(`${result.charges_without_rate} waiting for a rate.`);
      if (result.has_more) parts.push('Run again to bill the rest.');
      return { data: result, message: parts.join(' ') };
    },
  );
}

export async function recordMeteringReadingAction(form: FormData) {
  return runServerAction<string>('/guard/metering', async (requestId) => ({
    data: await recordMeteringReading(readModuleActionInput(form), requestId),
    message: 'Reading saved.',
  }));
}

export async function submitMeteringReadingAction(form: FormData) {
  return runServerAction<string>('/metering', async (requestId) => ({
    data: await submitMeteringReading(readModuleActionInput(form), requestId),
    message: 'Reading sent. An administrator will check it against the photo.',
  }));
}
