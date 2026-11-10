// Let society administrators decide pending self-registration requests.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  approveRegistrationAction,
  rejectRegistrationAction,
} from '@/app/(admin)/members/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { SocietyMember } from '@/core/members/operations';
import { Button } from '@/components/ui/button';

function ResultMessage({ result }: { result: ServerActionResult | null }) {
  if (!result) return null;
  return (
    <p
      aria-live="polite"
      className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
      role="status"
    >
      {result.message}
    </p>
  );
}

export function PendingRegistrations({
  registrations,
}: {
  registrations: readonly SocietyMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [reasons, setReasons] = useState<Readonly<Record<string, string>>>({});

  function decide(registration: SocietyMember, decision: 'approve' | 'reject') {
    const formData = new FormData();
    formData.set('membershipId', registration.membership_id);
    if (decision === 'reject') {
      formData.set('reason', reasons[registration.membership_id] ?? '');
    }
    setResult(null);
    startTransition(async () => {
      const nextResult =
        decision === 'approve'
          ? await approveRegistrationAction(formData)
          : await rejectRegistrationAction(formData);
      setResult(nextResult);
      if (nextResult.ok) {
        setReasons((current) => ({
          ...current,
          [registration.membership_id]: '',
        }));
        router.refresh();
      }
    });
  }

  if (registrations.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        There are no registrations waiting for approval.
      </p>
    );
  }

  return (
    <div className="grid gap-space-4">
      {registrations.map((registration) => (
        <article
          className="grid gap-space-3 rounded-md border border-rule p-space-4"
          key={registration.membership_id}
        >
          <div className="grid gap-space-1">
            <h3 className="text-body-strong">
              {registration.full_name || registration.email}
            </h3>
            <p className="text-caption text-ink-muted">
              {registration.email}
              {registration.unit_number
                ? ` · ${registration.block_name ? `${registration.block_name} · ` : ''}${registration.unit_number}`
                : ''}
              {registration.relationship
                ? ` · ${registration.relationship}`
                : ''}
            </p>
          </div>
          <label
            className="grid gap-space-1 text-caption"
            htmlFor={`reject-reason-${registration.membership_id}`}
          >
            Rejection note (optional)
            <input
              className="min-h-10 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
              id={`reject-reason-${registration.membership_id}`}
              maxLength={200}
              onChange={(event) => {
                const reason = event.currentTarget.value;
                setReasons((current) => ({
                  ...current,
                  [registration.membership_id]: reason,
                }));
              }}
              value={reasons[registration.membership_id] ?? ''}
            />
          </label>
          <div className="flex flex-wrap gap-space-2">
            <Button
              disabled={pending}
              loading={pending}
              onClick={() => decide(registration, 'approve')}
              type="button"
            >
              Approve
            </Button>
            <Button
              disabled={pending}
              onClick={() => decide(registration, 'reject')}
              type="button"
              variant="secondary"
            >
              Reject
            </Button>
          </div>
        </article>
      ))}
      <ResultMessage result={result} />
    </div>
  );
}
