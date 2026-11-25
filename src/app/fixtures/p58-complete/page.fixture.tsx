// Exercise P58 notice and billing completion screens without hosted data.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResultScreen } from '@/components/ui/result-screen';

function Preview() {
  const params = useSearchParams();
  const billing = params.get('kind') === 'billing';
  return billing ? (
    <ResultScreen
      actions={[
        {
          href: '/admin/billing?tab=bills',
          label: 'View bills',
          primary: true,
        },
        { href: '/admin/billing', label: 'Back to Billing' },
      ]}
      outcome="2 bills were generated for the selected billing period."
      summary={[
        { label: 'Billing month', value: 'November 2026' },
        { label: 'Bills generated', value: '2' },
        { label: 'Total amount', value: 'Rs. 5000.00' },
      ]}
      title="Bills generated"
    />
  ) : (
    <ResultScreen
      actions={[
        {
          href: '/admin/notices/notice-id',
          label: 'View notice',
          primary: true,
        },
        { href: '/admin/notices/new', label: 'Post another' },
        { href: '/admin/notices', label: 'Back to Notices' },
      ]}
      outcome="“Water shutdown” will go out on 26 Nov 2026, 10:00 am."
      summary={[
        { label: 'Audience', value: 'All residents' },
        { label: 'Reach', value: '6 residents' },
        { label: 'Posting time', value: '26 Nov 2026, 10:00 am' },
      ]}
      title="Notice scheduled"
    />
  );
}

export default function P58CompleteFixture() {
  return (
    <main>
      <Suspense fallback={<p>Loading result…</p>}>
        <Preview />
      </Suspense>
    </main>
  );
}
