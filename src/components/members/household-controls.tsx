// Resident controls for viewing household members and notification approvers.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setHouseholdApproverAction } from '@/app/(resident)/household/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { getHouseholdMembers } from '@/core/members/operations';

type HouseholdData = Awaited<ReturnType<typeof getHouseholdMembers>>;
type Household = HouseholdData['households'][number];
type HouseholdMember = Household['members'][number];

function ApproverControl({ member }: { member: HouseholdMember }) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(isApprover: boolean) {
    const formData = new FormData();
    formData.set('occupantId', member.occupant_id);
    formData.set('isApprover', String(isApprover));
    startTransition(async () => {
      const nextResult = await setHouseholdApproverAction(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  if (member.is_primary) {
    return (
      <span className="text-caption text-ink-muted">Primary resident</span>
    );
  }
  return (
    <div className="grid gap-space-2">
      <label className="inline-flex min-h-10 items-center gap-space-2">
        <input
          checked={member.is_approver}
          disabled={pending}
          onChange={(event) => submit(event.currentTarget.checked)}
          type="checkbox"
        />
        Can approve visitors
      </label>
      {result ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

export function HouseholdDirectory({ data }: { data: HouseholdData }) {
  if (!data.households.length) {
    return (
      <p className="text-body text-ink-muted">
        No active household has been assigned to your account yet.
      </p>
    );
  }
  return (
    <div className="grid gap-space-5">
      {data.households.map((household) => (
        <section
          aria-labelledby={`household-${household.unitId}`}
          className="grid gap-space-3"
          key={household.unitId}
        >
          <h2
            className="text-heading font-semibold"
            id={`household-${household.unitId}`}
          >
            {household.label}
          </h2>
          <ul className="grid gap-space-3">
            {household.members.map((member) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-4 medium:grid-cols-2 medium:items-center"
                key={member.occupant_id}
              >
                <div>
                  <p className="text-body-strong">{member.full_name}</p>
                  <p className="text-caption text-ink-muted">
                    {member.relationship}
                    {member.is_primary ? ' · primary resident' : ''}
                  </p>
                </div>
                <ApproverControl member={member} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
