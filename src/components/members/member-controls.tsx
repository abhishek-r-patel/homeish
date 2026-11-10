// Accessible member and occupancy controls for society administrators.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  assignOccupantAction,
  changeMemberRolesAction,
  deactivateMemberAction,
  endOccupancyAction,
  inviteResidentAction,
  moveOccupantAction,
} from '@/app/(admin)/members/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { listSocietyMembers } from '@/core/members/operations';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { TextInput } from '@/components/ui/text-input';

type Directory = Awaited<ReturnType<typeof listSocietyMembers>>;
type Member = Directory['members'][number];
type Unit = Directory['units'][number];

const ROLES = [
  ['admin', 'Administrator'],
  ['committee', 'Committee'],
  ['guard', 'Guard'],
  ['hk_supervisor', 'Housekeeping supervisor'],
  ['resident', 'Resident'],
] as const;

function ActionMessage({ result }: { result: ServerActionResult | null }) {
  if (!result) return null;
  return (
    <p
      aria-live="polite"
      className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
      role="status"
    >
      {result.message}
      {!result.ok && result.fieldErrors
        ? ` ${Object.values(result.fieldErrors).join(' ')}`
        : ''}
    </p>
  );
}

function useAction(
  action: (formData: FormData) => Promise<ServerActionResult>,
  resetOnSuccess = false,
) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const nextResult = await action(formData);
      setResult(nextResult);
      if (nextResult.ok) {
        if (resetOnSuccess) form.reset();
        router.refresh();
      }
    });
  }
  return { pending, result, submit };
}

function RoleOptions({ selected = ['resident'] }: { selected?: string[] }) {
  return (
    <fieldset className="grid gap-space-2">
      <legend className="text-body-strong">Society roles</legend>
      <div className="flex flex-wrap gap-space-3">
        {ROLES.map(([value, label]) => (
          <label
            className="inline-flex min-h-10 items-center gap-space-2"
            key={value}
          >
            <input
              defaultChecked={selected.includes(value)}
              name="roles"
              type="checkbox"
              value={value}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function InviteResidentForm({ units }: { units: readonly Unit[] }) {
  const { pending, result, submit } = useAction(inviteResidentAction, true);
  const [relationship, setRelationship] = useState<
    'owner' | 'tenant' | 'family'
  >('owner');
  const [isApprover, setIsApprover] = useState(true);
  if (!units.length) {
    return (
      <p className="text-body text-ink-muted">
        Add an active unit in Society Structure before inviting residents.
      </p>
    );
  }
  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <TextInput
        id="invite-email"
        label="Email address"
        name="email"
        required
        type="email"
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="invite-unit"
      >
        Unit
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          id="invite-unit"
          name="unitId"
          required
        >
          <option value="">Choose a unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.number}
            </option>
          ))}
        </select>
      </label>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="invite-relationship"
      >
        Relationship
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          id="invite-relationship"
          name="relationship"
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value === 'owner' || value === 'tenant' || value === 'family') {
              setRelationship(value);
              setIsApprover(value !== 'family');
            }
          }}
          value={relationship}
        >
          <option value="owner">Owner</option>
          <option value="tenant">Tenant</option>
          <option value="family">Family</option>
        </select>
      </label>
      <RoleOptions />
      <div className="flex flex-wrap gap-space-4">
        <label className="inline-flex min-h-10 items-center gap-space-2">
          <input
            disabled={relationship === 'family'}
            name="isPrimary"
            type="checkbox"
          />
          Primary resident
        </label>
        <label className="inline-flex min-h-10 items-center gap-space-2">
          <input
            checked={isApprover}
            name="isApprover"
            onChange={(event) => setIsApprover(event.currentTarget.checked)}
            type="checkbox"
          />
          Can approve visitors
        </label>
      </div>
      <Button disabled={pending} loading={pending} type="submit">
        Send invitation
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

function MemberRolesForm({ member }: { member: Member }) {
  const { pending, result, submit } = useAction(changeMemberRolesAction);
  return (
    <form className="grid gap-space-2" onSubmit={submit}>
      <input name="membershipId" type="hidden" value={member.membership_id} />
      <RoleOptions selected={member.roles} />
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant="secondary"
      >
        Save roles
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

function AssignOccupancyForm({
  member,
  units,
}: {
  member: Member;
  units: readonly Unit[];
}) {
  const { pending, result, submit } = useAction(assignOccupantAction);
  const [relationship, setRelationship] = useState<
    'owner' | 'tenant' | 'family'
  >('owner');
  const [isApprover, setIsApprover] = useState(true);
  return (
    <form className="grid gap-space-2" onSubmit={submit}>
      <input name="membershipId" type="hidden" value={member.membership_id} />
      <label
        className="grid gap-space-1 text-caption"
        htmlFor={`assign-${member.membership_id}`}
      >
        Assign unit
        <select
          className="min-h-10 rounded-md border border-rule-strong bg-surface px-space-2"
          id={`assign-${member.membership_id}`}
          name="unitId"
          required
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.number}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-space-1 text-caption">
        Relationship
        <select
          className="min-h-10 rounded-md border border-rule-strong bg-surface px-space-2"
          name="relationship"
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value === 'owner' || value === 'tenant' || value === 'family') {
              setRelationship(value);
              setIsApprover(value !== 'family');
            }
          }}
          value={relationship}
        >
          <option value="owner">Owner</option>
          <option value="tenant">Tenant</option>
          <option value="family">Family</option>
        </select>
      </label>
      <label className="inline-flex min-h-10 items-center gap-space-2 text-caption">
        <input name="isPrimary" type="checkbox" />
        Primary
      </label>
      <label className="inline-flex min-h-10 items-center gap-space-2 text-caption">
        <input
          checked={isApprover}
          name="isApprover"
          onChange={(event) => setIsApprover(event.currentTarget.checked)}
          type="checkbox"
        />
        Approver
      </label>
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant="secondary"
      >
        Assign
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

function OccupancyControls({
  member,
  units,
}: {
  member: Member;
  units: readonly Unit[];
}) {
  const move = useAction(moveOccupantAction);
  const end = useAction(endOccupancyAction);
  if (!member.occupant_id || member.occupant_status !== 'active') return null;
  return (
    <div className="grid gap-space-2">
      <form className="grid gap-space-2" onSubmit={move.submit}>
        <input name="occupantId" type="hidden" value={member.occupant_id} />
        <label className="grid gap-space-1 text-caption">
          Move to
          <select
            className="min-h-10 rounded-md border border-rule-strong bg-surface px-space-2"
            name="unitId"
          >
            {units
              .filter((unit) => unit.id !== member.unit_id)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.number}
                </option>
              ))}
          </select>
        </label>
        <Button
          disabled={move.pending}
          loading={move.pending}
          type="submit"
          variant="secondary"
        >
          Move
        </Button>
        <ActionMessage result={move.result} />
      </form>
      <form className="grid gap-space-2" onSubmit={end.submit}>
        <input name="occupantId" type="hidden" value={member.occupant_id} />
        <Button
          disabled={end.pending}
          loading={end.pending}
          type="submit"
          variant="secondary"
        >
          End occupancy
        </Button>
        <ActionMessage result={end.result} />
      </form>
    </div>
  );
}

function DeactivateMemberForm({ member }: { member: Member }) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  if (member.status === 'deactivated') return <span>Access deactivated</span>;
  return (
    <>
      <Button
        disabled={pending}
        onClick={() => setConfirming(true)}
        type="button"
        variant="secondary"
      >
        Deactivate
      </Button>
      <ConfirmDialog
        actionLabel="Deactivate member"
        description="This immediately revokes the member's access to this society and ends any active unit occupancy. History is kept."
        id={`deactivate-member-${member.membership_id}`}
        loading={pending}
        onConfirm={() => {
          const formData = new FormData();
          formData.set('membershipId', member.membership_id);
          startTransition(async () => {
            const nextResult = await deactivateMemberAction(formData);
            setResult(nextResult);
            setConfirming(false);
            if (nextResult.ok) router.refresh();
          });
        }}
        onOpenChange={setConfirming}
        open={confirming}
        title="Deactivate member?"
        variant="destructive"
      />
      <ActionMessage result={result} />
    </>
  );
}

export function MemberDirectory({ directory }: { directory: Directory }) {
  return (
    <section className="grid gap-space-5">
      <div className="grid gap-space-3">
        <h2 className="text-heading font-semibold">People</h2>
        {directory.members.map((member, index) => (
          <article
            className="grid gap-space-4 rounded-md border border-rule p-space-4 expanded:grid-cols-2"
            key={`${member.membership_id}-${member.occupant_id ?? index}`}
          >
            <div className="grid content-start gap-space-1">
              <h3 className="text-body-strong">
                {member.full_name ?? member.email}
              </h3>
              <p className="text-caption text-ink-muted">{member.email}</p>
              {member.phone_masked ? (
                <p className="text-caption text-ink-muted">
                  Phone ending {member.phone_masked.slice(-4)}
                </p>
              ) : null}
              <p className="text-caption">
                {member.status} · {member.roles.join(', ')}
              </p>
              {member.unit_number ? (
                <p className="text-caption">
                  {member.block_name ? `${member.block_name} · ` : ''}
                  {member.unit_number} · {member.relationship}
                  {member.is_primary ? ' · primary' : ''}
                  {member.is_approver ? ' · approver' : ''}
                </p>
              ) : null}
            </div>
            <div className="grid gap-space-4">
              {directory.canManage && member.status !== 'deactivated' ? (
                <MemberRolesForm member={member} />
              ) : null}
              {directory.canManage &&
              member.roles.includes('resident') &&
              member.status === 'active' &&
              !member.occupant_id ? (
                <AssignOccupancyForm member={member} units={directory.units} />
              ) : directory.canManage ? (
                <OccupancyControls member={member} units={directory.units} />
              ) : null}
              {directory.canManage ? (
                <DeactivateMemberForm member={member} />
              ) : null}
            </div>
          </article>
        ))}
        {!directory.members.length ? (
          <p className="text-body text-ink-muted">
            No members or invitations yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
