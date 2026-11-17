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
import { useUiTranslator } from '@/components/ui/language';
import { MEMBER_LABELS } from './presentation';

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
  const { translateFeedback } = useUiTranslator();
  if (!result) return null;
  return (
    <p
      aria-live="polite"
      className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
      role="status"
    >
      {result.message ? translateFeedback(result.message) : null}
      {!result.ok && result.fieldErrors
        ? ` ${Object.values(result.fieldErrors).map(translateFeedback).join(' ')}`
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
  const { translate: t } = useUiTranslator();
  return (
    <fieldset className="grid gap-space-2">
      <legend className="text-body-strong">{t('Society roles')}</legend>
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
            {t(label)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function InviteResidentForm({ units }: { units: readonly Unit[] }) {
  const { translate: t } = useUiTranslator();
  const { pending, result, submit } = useAction(inviteResidentAction, true);
  const [relationship, setRelationship] = useState<
    'owner' | 'tenant' | 'family'
  >('owner');
  const [isApprover, setIsApprover] = useState(true);
  if (!units.length) {
    return (
      <p className="text-body text-ink-muted">
        {t(
          'Add an active unit in Society Structure before inviting residents.',
        )}
      </p>
    );
  }
  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <TextInput
        id="invite-email"
        label={t('Email address')}
        name="email"
        required
        type="email"
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="invite-unit"
      >
        {t('Unit')}
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          id="invite-unit"
          name="unitId"
          required
        >
          <option value="">{t('Choose a unit')}</option>
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
        {t('Relationship')}
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
          <option value="owner">{t('Owner')}</option>
          <option value="tenant">{t('Tenant')}</option>
          <option value="family">{t('Family')}</option>
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
          {t('Primary resident')}
        </label>
        <label className="inline-flex min-h-10 items-center gap-space-2">
          <input
            checked={isApprover}
            name="isApprover"
            onChange={(event) => setIsApprover(event.currentTarget.checked)}
            type="checkbox"
          />
          {t('Can approve visitors')}
        </label>
      </div>
      <Button disabled={pending} loading={pending} type="submit">
        {t('Send invitation')}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

function MemberRolesForm({ member }: { member: Member }) {
  const { translate: t } = useUiTranslator();
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
        {t('Save roles')}
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
  const { translate: t } = useUiTranslator();
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
        {t('Assign unit')}
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
        {t('Relationship')}
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
          <option value="owner">{t('Owner')}</option>
          <option value="tenant">{t('Tenant')}</option>
          <option value="family">{t('Family')}</option>
        </select>
      </label>
      <label className="inline-flex min-h-10 items-center gap-space-2 text-caption">
        <input name="isPrimary" type="checkbox" />
        {t('Primary')}
      </label>
      <label className="inline-flex min-h-10 items-center gap-space-2 text-caption">
        <input
          checked={isApprover}
          name="isApprover"
          onChange={(event) => setIsApprover(event.currentTarget.checked)}
          type="checkbox"
        />
        {t('Approver')}
      </label>
      <Button
        disabled={pending}
        loading={pending}
        type="submit"
        variant="secondary"
      >
        {t('Assign')}
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
  const { translate: t } = useUiTranslator();
  const move = useAction(moveOccupantAction);
  const end = useAction(endOccupancyAction);
  if (!member.occupant_id || member.occupant_status !== 'active') return null;
  return (
    <div className="grid gap-space-2">
      <form className="grid gap-space-2" onSubmit={move.submit}>
        <input name="occupantId" type="hidden" value={member.occupant_id} />
        <label className="grid gap-space-1 text-caption">
          {t('Move to')}
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
          {t('Move')}
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
          {t('End occupancy')}
        </Button>
        <ActionMessage result={end.result} />
      </form>
    </div>
  );
}

function DeactivateMemberForm({ member }: { member: Member }) {
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  if (member.status === 'deactivated')
    return <span>{t('Access deactivated')}</span>;
  return (
    <>
      <Button
        disabled={pending}
        onClick={() => setConfirming(true)}
        type="button"
        variant="secondary"
      >
        {t('Deactivate')}
      </Button>
      <ConfirmDialog
        actionLabel={t('Deactivate member')}
        description={t(
          "This immediately revokes the member's access to this society and ends any active unit occupancy. History is kept.",
        )}
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
        title={t('Deactivate member?')}
        variant="destructive"
      />
      <ActionMessage result={result} />
    </>
  );
}

export function MemberDirectory({ directory }: { directory: Directory }) {
  const { translate: t } = useUiTranslator();
  return (
    <section className="grid gap-space-5">
      <div className="grid gap-space-3">
        <h2 className="text-heading font-semibold">{t('People')}</h2>
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
                  {t('Phone ending {digits}', {
                    digits: member.phone_masked.slice(-4),
                  })}
                </p>
              ) : null}
              <p className="text-caption">
                {t(MEMBER_LABELS[member.status] ?? member.status)} ·{' '}
                {member.roles
                  .map((role) => t(MEMBER_LABELS[role] ?? role))
                  .join(', ')}
              </p>
              {member.unit_number ? (
                <p className="text-caption">
                  {member.block_name ? `${member.block_name} · ` : ''}
                  {member.unit_number} ·{' '}
                  {member.relationship
                    ? t(
                        MEMBER_LABELS[member.relationship] ??
                          member.relationship,
                      )
                    : ''}
                  {member.is_primary ? t(' · primary') : ''}
                  {member.is_approver ? t(' · approver') : ''}
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
            {t('No members or invitations yet.')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
