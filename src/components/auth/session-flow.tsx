// Render society selection and the waiting/no-membership session states.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  signOutAction,
  switchSocietyAction,
  type AuthActionState,
} from '../../app/(auth)/actions';
import type {
  SessionSociety,
  SessionSnapshot,
} from '../../core/tenancy/session';
import { Banner } from '../ui/feedback';
import { Button } from '../ui/button';

function ActionNotice({ state }: { state: AuthActionState | null }) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'success' : 'danger'}>
      <p>{state.message ?? 'The request completed.'}</p>
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          Reference ID: <code>{state.referenceId}</code>
        </p>
      ) : null}
    </Banner>
  );
}

function roleLabel(roles: readonly string[]): string {
  return roles.map((role) => role.replaceAll('_', ' ')).join(', ');
}

function useSessionActions() {
  const router = useRouter();
  const [notice, setNotice] = useState<AuthActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function chooseSociety(societyId: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await switchSocietyAction(societyId);
      setNotice(result);
      if (result.ok) {
        router.replace('/session');
        router.refresh();
      }
    });
  }

  function signOut() {
    setNotice(null);
    startTransition(async () => {
      const result = await signOutAction();
      setNotice(result);
      if (result.ok) {
        router.replace('/login');
        router.refresh();
      }
    });
  }

  return { chooseSociety, notice, pending, signOut };
}

function SocietyOptions({
  societies,
  selectedSocietyId,
  onChoose,
  pending,
}: {
  societies: readonly SessionSociety[];
  selectedSocietyId: string | null;
  onChoose: (societyId: string) => void;
  pending: boolean;
}) {
  return (
    <ul className="grid gap-space-3">
      {societies.map((society) => (
        <li key={society.id}>
          <Button
            aria-pressed={society.id === selectedSocietyId}
            className="justify-between text-left"
            disabled={pending || society.id === selectedSocietyId}
            onClick={() => onChoose(society.id)}
            variant="secondary"
          >
            <span className="grid gap-space-1 text-left">
              <span>{society.name}</span>
              <span className="text-caption font-normal text-ink-muted">
                {roleLabel(society.roles)}
                {society.status === 'suspended' ? ' · Suspended' : ''}
              </span>
            </span>
            <span aria-hidden="true">›</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SignOutButton({
  onSignOut,
  pending,
}: {
  onSignOut: () => void;
  pending: boolean;
}) {
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={onSignOut}
      variant="tertiary"
    >
      Sign out
    </Button>
  );
}

export function SocietyPicker({
  session,
  activeSocieties,
}: {
  session: SessionSnapshot;
  activeSocieties: readonly SessionSociety[];
}) {
  const { chooseSociety, notice, pending, signOut } = useSessionActions();
  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Society selection
        </p>
        <h1 className="text-heading font-semibold">Choose your society</h1>
        <p className="text-body text-ink-muted">
          You’re signed in as {session.user.fullName}. Choose where you want to
          continue.
        </p>
      </div>
      <ActionNotice state={notice} />
      <SocietyOptions
        onChoose={chooseSociety}
        pending={pending}
        selectedSocietyId={session.activeSocietyId}
        societies={activeSocieties}
      />
      <SignOutButton onSignOut={signOut} pending={pending} />
    </div>
  );
}

export function CurrentSession({
  session,
  activeSociety,
  activeSocieties,
  pendingSocieties,
}: {
  session: SessionSnapshot;
  activeSociety: SessionSociety;
  activeSocieties: readonly SessionSociety[];
  pendingSocieties: readonly SessionSociety[];
}) {
  const { chooseSociety, notice, pending, signOut } = useSessionActions();
  const [showSocieties, setShowSocieties] = useState(false);

  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Signed in
        </p>
        <h1 className="text-heading font-semibold">{activeSociety.name}</h1>
        <p className="text-body text-ink-muted">
          {session.user.fullName} · {roleLabel(activeSociety.roles)}
        </p>
      </div>
      {activeSociety.status === 'suspended' ? (
        <Banner tone="warning">
          <p>
            This society is suspended. You can view information, but actions may
            be unavailable.
          </p>
        </Banner>
      ) : null}
      <ActionNotice state={notice} />
      {pendingSocieties.length > 0 ? (
        <section className="grid gap-space-2" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-body-strong">
            Waiting for approval
          </h2>
          <p className="text-caption text-ink-muted">
            {pendingSocieties.map(({ name }) => name).join(', ')}
          </p>
        </section>
      ) : null}
      {activeSocieties.length > 1 ? (
        <section className="grid gap-space-3" aria-labelledby="switch-heading">
          <h2 id="switch-heading" className="text-body-strong">
            Switch society
          </h2>
          {showSocieties ? (
            <SocietyOptions
              onChoose={chooseSociety}
              pending={pending}
              selectedSocietyId={session.activeSocietyId}
              societies={activeSocieties}
            />
          ) : (
            <Button
              disabled={pending}
              onClick={() => setShowSocieties(true)}
              variant="secondary"
            >
              Choose another society
            </Button>
          )}
        </section>
      ) : null}
      {session.isDeveloperAccount ? (
        <Link
          className="text-caption text-brand underline"
          href={session.mfaVerified ? '/developer' : '/developer/login'}
        >
          Open Developer Console
        </Link>
      ) : null}
      <SignOutButton onSignOut={signOut} pending={pending} />
    </div>
  );
}

export function MembershipStatus({
  session,
  pendingSocieties,
}: {
  session: SessionSnapshot;
  pendingSocieties: readonly SessionSociety[];
}) {
  const { notice, pending, signOut } = useSessionActions();
  const waiting = pendingSocieties.length > 0;
  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {waiting ? 'Waiting for approval' : 'No society access'}
        </p>
        <h1 className="text-heading font-semibold">
          {waiting ? 'Your request is pending' : 'No society is linked yet'}
        </h1>
        <p className="text-body text-ink-muted">
          {waiting
            ? `A society administrator will review your membership for ${session.user.fullName}. You can sign in again later to check its status.`
            : `Ask your society administrator to invite ${session.user.fullName} at this email address. Homeish does not allow open sign-up.`}
        </p>
      </div>
      {pendingSocieties.length > 0 ? (
        <ul className="grid gap-space-2">
          {pendingSocieties.map((society) => (
            <li className="text-body-strong" key={society.id}>
              {society.name}
            </li>
          ))}
        </ul>
      ) : null}
      <ActionNotice state={notice} />
      <SignOutButton onSignOut={signOut} pending={pending} />
      {!waiting ? (
        <Link className="text-caption text-brand underline" href="/register">
          Request access with a society code
        </Link>
      ) : null}
      <Link className="text-caption text-brand underline" href="/login">
        Sign in with a different email
      </Link>
    </div>
  );
}
