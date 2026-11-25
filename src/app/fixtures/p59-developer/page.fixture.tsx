// Exercise P59 developer-only controls without a hosted society or database.
'use client';

import { useState } from 'react';
import { CommitteeHistoryControl } from '@/components/developer/console-controls';
import { DeveloperAuditSocietyPrompt } from '@/components/developer/audit-society-prompt';

export default function P59DeveloperFixture() {
  const [enabled, setEnabled] = useState(false);
  return (
    <main className="mx-auto grid max-w-content-narrow gap-space-5 p-space-5">
      <h1 className="text-title font-semibold">P59 developer controls</h1>
      <CommitteeHistoryControl
        action={async (formData) => {
          const next = formData.get('enabled') === 'true';
          setEnabled(next);
          return {
            ok: true,
            message: next
              ? 'Committee members can now see change history.'
              : 'Committee change-history access is off.',
          };
        }}
        enabled={enabled}
        societyId="11111111-1111-4111-8111-111111111111"
      />
      <DeveloperAuditSocietyPrompt />
    </main>
  );
}
