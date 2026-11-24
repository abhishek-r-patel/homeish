// Exercise P57 developer website settings and private enquiry controls with synthetic data.
'use client';

import { useState } from 'react';
import {
  DeveloperWebsiteEnquiries,
  DeveloperWebsiteSettings,
} from '@/components/developer/console-controls';
import { DeveloperShell } from '@/components/app-shells';
import { Card } from '@/components/ui/data-display';

export default function P57DeveloperFixture() {
  const [handled, setHandled] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <DeveloperShell>
      <section className="grid gap-space-5">
        <h1 className="text-title font-semibold">Website controls</h1>
        <Card title="Website settings">
          <DeveloperWebsiteSettings
            saveAction={async () => ({
              ok: true,
              message: 'Website settings saved.',
            })}
            settings={{
              contactEmail: 'hello@example.test',
              enquiryHourlyLimit: 5,
              updatedAt: '2026-11-24T00:00:00.000Z',
              updatedBy: null,
            }}
          />
        </Card>
        <Card title="Website enquiries">
          {deleted ? (
            <p>No website enquiries.</p>
          ) : (
            <DeveloperWebsiteEnquiries
              deleteAction={async () => {
                setDeleted(true);
                return { ok: true, message: 'Enquiry deleted.' };
              }}
              enquiries={[
                {
                  id: 'f57ab6d1-0000-4000-8000-000000000001',
                  full_name: 'Synthetic Sender',
                  society_name: 'Synthetic Society',
                  city: 'Pune',
                  flat_count: 120,
                  email: 'sender@example.test',
                  phone: '+919876543210',
                  message: 'Please contact our committee.',
                  status: handled ? 'handled' : 'new',
                  submitted_at: '2026-11-24T00:00:00.000Z',
                  handled_at: handled ? '2026-11-24T01:00:00.000Z' : null,
                },
              ]}
              handleAction={async () => {
                setHandled(true);
                return { ok: true, message: 'Enquiry marked as handled.' };
              }}
            />
          )}
        </Card>
      </section>
    </DeveloperShell>
  );
}
