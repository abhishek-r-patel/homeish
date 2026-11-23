// Keep compliance register mutations behind the standard action boundary.
'use server';

import { runServerAction } from '@/core/actions/server-action';
import {
  acknowledgeCompliance,
  saveComplianceEntry,
  saveComplianceReminders,
  saveDataCleanupRule,
} from '@/core/compliance/operations';
import { ValidationError } from '@/core/errors';

function input(formData: FormData) {
  const value = formData.get('input');
  if (typeof value !== 'string')
    throw new ValidationError({ form: 'Compliance details are missing.' });
  try {
    return JSON.parse(value);
  } catch {
    throw new ValidationError({ form: 'Compliance details are invalid.' });
  }
}

export async function acknowledgeComplianceAction(formData: FormData) {
  const value = formData.get('accepted');
  if (value !== 'true') {
    return runServerAction('/admin/compliance', async () => {
      throw new ValidationError({
        accepted: 'Acknowledge the warning before continuing.',
      });
    });
  }
  return runServerAction('/admin/compliance', async (requestId) => ({
    data: await acknowledgeCompliance(requestId),
    message: 'Compliance register acknowledgement recorded.',
  }));
}

export async function saveComplianceEntryAction(formData: FormData) {
  return runServerAction('/admin/compliance', async (requestId) => ({
    data: await saveComplianceEntry(input(formData), requestId),
    message: 'Compliance record saved with revision history.',
  }));
}

export async function saveComplianceRemindersAction(formData: FormData) {
  return runServerAction('/admin/compliance', async (requestId) => {
    await saveComplianceReminders(input(formData), requestId);
    return 'Compliance reminders updated.';
  });
}

export async function saveDataCleanupRuleAction(formData: FormData) {
  return runServerAction('/admin/settings#data-cleanup', async (requestId) => ({
    data: await saveDataCleanupRule(input(formData), requestId),
    message:
      'Data cleanup rule saved. Permanent deletion runs only after the configured age.',
  }));
}
