// Apply visitor administration actions through the shared server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  addVisitorBlacklistEntry,
  removeVisitorBlacklistEntry,
  updateVisitorSettings,
} from '@/core/visitor/operations';

function value(formData: FormData, key: string) {
  const result = formData.get(key);
  return typeof result === 'string' ? result : '';
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

export async function addVisitorBlacklistAction(formData: FormData) {
  return runServerAction('visitor.blacklist.add', async (requestId) => {
    await addVisitorBlacklistEntry(
      {
        phone: value(formData, 'phone'),
        name: value(formData, 'name') || undefined,
        reason: value(formData, 'reason') || undefined,
      },
      requestId,
    );
    revalidatePath('/admin/visitors');
    revalidatePath('/guard/visitors');
    return 'Number added to the visitor blacklist.';
  });
}

export async function removeVisitorBlacklistAction(formData: FormData) {
  return runServerAction('visitor.blacklist.remove', async (requestId) => {
    await removeVisitorBlacklistEntry(
      value(formData, 'blacklistId'),
      requestId,
    );
    revalidatePath('/admin/visitors');
    revalidatePath('/guard/visitors');
    return 'Number removed from the visitor blacklist.';
  });
}

export async function updateVisitorSettingsAction(formData: FormData) {
  return runServerAction('visitor.settings.update', async (requestId) => {
    await updateVisitorSettings(
      {
        approval_timeout_minutes: Number(
          value(formData, 'approvalTimeoutMinutes'),
        ),
        overstay_hours: Number(value(formData, 'overstayHours')),
        photo_required: checked(formData, 'photoRequired'),
        guard_override_allowed: checked(formData, 'guardOverrideAllowed'),
        phone_required: checked(formData, 'phoneRequired'),
      },
      requestId,
    );
    revalidatePath('/admin/visitors');
    revalidatePath('/guard/visitors');
    return 'Visitor settings saved.';
  });
}
