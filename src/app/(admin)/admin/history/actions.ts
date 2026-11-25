// Submit P59 settings undo through the standard server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { undoAuditSetting } from '@/core/audit/history';

export async function undoAuditSettingAction(formData: FormData) {
  return runServerAction('audit.setting.undo', async (requestId) => {
    const result = await undoAuditSetting(
      { auditId: String(formData.get('auditId') ?? '') },
      requestId,
    );
    revalidatePath('/admin/history');
    return { data: result, message: 'The setting change was undone.' };
  });
}
