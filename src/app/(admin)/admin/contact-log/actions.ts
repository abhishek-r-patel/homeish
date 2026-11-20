// Create and update member contact log entries through audited P53 operations.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { saveContactLog } from '@/core/communication/operations';

const ROUTE = '/admin/contact-log';

export async function saveContactLogAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveContactLog(readModuleActionInput(form), requestId);
    return 'Contact saved.';
  });
}
