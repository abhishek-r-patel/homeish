// Exercise the P57 homepage and enquiry states with no hosted database or email access.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MarketingPage } from '@/core/website/marketing-page';

function Preview() {
  const params = useSearchParams();
  const noContact = params.get('contact') === 'none';
  const rateLimited = params.get('state') === 'limit';
  return (
    <MarketingPage
      contactSettingsAction={async () => ({
        ok: true,
        data: {
          contactEmail: noContact ? null : 'hello@example.test',
          enquiryHourlyLimit: 5,
        },
      })}
      enquiryAction={async () =>
        rateLimited
          ? {
              ok: false,
              code: 'RATE_LIMITED',
              message: 'Please wait before sending another enquiry.',
              retryAfterSeconds: 180,
            }
          : {
              ok: true,
              message: 'Thanks. Your enquiry was saved for the Homeish team.',
            }
      }
      websiteOrigin="http://127.0.0.1:3000"
    />
  );
}

export default function P57HomepageFixture() {
  return (
    <Suspense fallback={<p className="p-space-5">Loading homepage preview…</p>}>
      <Preview />
    </Suspense>
  );
}
