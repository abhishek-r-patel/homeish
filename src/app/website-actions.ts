// Expose the public P57 enquiry form through a validated Server Action.
'use server';

import { headers } from 'next/headers';
import { runServerAction } from '@/core/actions/server-action';
import { requestIdFromHeaders } from '@/core/errors';
import { clientIpFromHeaders } from '@/core/request/client-ip';
import {
  getPublicWebsiteSettings,
  submitWebsiteEnquiry,
} from '@/core/website/enquiries';

export async function getPublicWebsiteSettingsAction() {
  return runServerAction('website.settings.get', async () => ({
    data: await getPublicWebsiteSettings(),
  }));
}

export async function submitWebsiteEnquiryAction(formData: FormData) {
  const requestHeaders = await headers();
  const requestId = requestIdFromHeaders(requestHeaders);
  return runServerAction('website.enquiry.submit', async () => {
    await submitWebsiteEnquiry(
      {
        fullName: formData.get('fullName'),
        societyName: formData.get('societyName') ?? '',
        city: formData.get('city') ?? '',
        flatCount: formData.get('flatCount') ?? '',
        email: formData.get('email') ?? '',
        phone: formData.get('phone') ?? '',
        message: formData.get('message') ?? '',
        trap: formData.get('company') ?? '',
      },
      clientIpFromHeaders(requestHeaders),
      requestId,
    );
    return 'Thanks. Your enquiry was saved for the Homeish developer.';
  });
}
