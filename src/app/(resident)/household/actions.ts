// Authorize and validate household preference changes at the server boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { setHouseholdApprover } from '@/core/members/operations';

export async function setHouseholdApproverAction(formData: FormData) {
  return runServerAction('household.members.setApprover', async (requestId) => {
    await setHouseholdApprover(formData, requestId);
    revalidatePath('/household');
    return 'Household approver preference saved.';
  });
}
