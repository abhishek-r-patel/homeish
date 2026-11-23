// Keep admin-only official case mutations behind the standard action boundary.
'use server';

import { runServerAction } from '@/core/actions/server-action';
import {
  linkOfficialCaseEvidence,
  saveOfficialCase,
  saveOfficialCaseReminders,
} from '@/core/document/official-cases';
import { ValidationError } from '@/core/errors';

function input(formData: FormData) {
  const value = formData.get('input');
  if (typeof value !== 'string')
    throw new ValidationError({ form: 'Official case details are missing.' });
  try {
    return JSON.parse(value);
  } catch {
    throw new ValidationError({ form: 'Official case details are invalid.' });
  }
}

export async function saveOfficialCaseAction(formData: FormData) {
  return runServerAction('/admin/documents', async (requestId) => ({
    data: await saveOfficialCase(input(formData), requestId),
    message: 'Official case saved with private revision history.',
  }));
}

export async function linkOfficialCaseEvidenceAction(formData: FormData) {
  return runServerAction('/admin/documents', async (requestId) => ({
    data: await linkOfficialCaseEvidence(input(formData), requestId),
    message: 'Private case evidence linked.',
  }));
}

export async function saveOfficialCaseRemindersAction(formData: FormData) {
  return runServerAction('/admin/documents', async (requestId) => {
    await saveOfficialCaseReminders(input(formData), requestId);
    return 'Official case reminders updated.';
  });
}
