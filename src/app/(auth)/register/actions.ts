// Expose society-code lookup and registration submission through server actions.
'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requestIdFromHeaders } from '@/core/errors';
import { clientIpFromHeaders } from '@/core/request/client-ip';
import { runServerAction } from '@/core/actions/server-action';
import {
  lookupSociety,
  submitRegistration,
} from '@/core/registration/operations';

export async function lookupSocietyAction(joinCode: string) {
  const requestHeaders = await headers();
  const requestId = requestIdFromHeaders(requestHeaders);
  return runServerAction('registration.lookupSociety', async () => ({
    data: await lookupSociety(
      joinCode,
      clientIpFromHeaders(requestHeaders),
      requestId,
    ),
  }));
}

export async function submitRegistrationAction(formData: FormData) {
  return runServerAction('registration.submit', async (requestId) => {
    await submitRegistration(
      {
        joinCode: formData.get('joinCode'),
        unitId: formData.get('unitId'),
        fullName: formData.get('fullName'),
        relationship: formData.get('relationship'),
      },
      requestId,
    );
    revalidatePath('/session');
    return 'Registration submitted. Waiting for society approval.';
  });
}
