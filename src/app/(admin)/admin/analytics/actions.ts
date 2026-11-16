// Expose the authorized analytics settings change to the admin settings screen.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { updateAnalyticsSettings } from '@/core/analytics/operations';

export async function updateAnalyticsSettingsAction(form: FormData) {
  return runServerAction('/admin/analytics/settings', async (requestId) => {
    await updateAnalyticsSettings(readModuleActionInput(form), requestId);
    return 'Analytics settings saved.';
  });
}
