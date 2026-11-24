// Exercise the read-only compliance register with synthetic, factual records.
import { ComplianceWorkspaceView } from '@/components/compliance/workspace';

const id = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';

export default function ComplianceFixturePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-content-default px-space-4 py-space-6">
      <ComplianceWorkspaceView
        workspace={{
          warning: 'These records are not legal advice or certification.',
          acknowledged_at: '2026-11-23T12:00:00.000Z',
          can_manage: false,
          reminders_enabled: false,
          responsible_choices: [],
          evidence_choices: [],
          entries: [
            {
              id,
              title: 'Synthetic annual filing',
              authority: 'Society-entered registrar source',
              recurrence: 'yearly',
              due_date: '2026-12-01',
              next_due_date: '2026-12-01',
              responsible_membership_id: id,
              responsible_name: 'Synthetic Secretary',
              status: 'pending',
              completed_on: null,
              evidence_version_id: null,
              evidence_name: null,
              note: 'No legal deadline is supplied by Homeish.',
              version: 1,
              updated_at: '2026-11-23T12:00:00.000Z',
              due_state: 'upcoming',
            },
          ],
        }}
      />
    </main>
  );
}
