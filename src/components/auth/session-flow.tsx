// Render society selection and the waiting/no-membership session states.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  signOutAction,
  switchSocietyAction,
  type AuthActionState,
} from '../../app/(auth)/actions';
import type {
  SessionSociety,
  SessionSnapshot,
} from '../../core/tenancy/session';
import {
  translateAuthMessage,
  translateKnownAuthResponse,
} from '../../core/i18n/catalogs/hi-auth';
import type { MessageValues } from '../../core/i18n/messages';
import { resolveStartingPlace } from '../../core/tenancy/starting-place';
import { useLanguage } from '../language-provider';
import { Banner } from '../ui/feedback';
import { Button } from '../ui/button';

function ActionNotice({
  state,
  translateResponse,
}: {
  state: AuthActionState | null;
  translateResponse: (source: string) => string;
}) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'success' : 'danger'}>
      <p>{translateResponse(state.message ?? 'The request completed.')}</p>
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          {translateResponse('Reference ID:')} <code>{state.referenceId}</code>
        </p>
      ) : null}
    </Banner>
  );
}

function roleLabel(
  roles: readonly string[],
  translateResponse: (source: string) => string,
): string {
  return roles
    .map((role) => translateResponse(role.replaceAll('_', ' ')))
    .join(', ');
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
  translateResponse,
}: {
  societies: readonly SessionSociety[];
  selectedSocietyId: string | null;
  onChoose: (societyId: string) => void;
  pending: boolean;
  translateResponse: (source: string) => string;
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
                {roleLabel(society.roles, translateResponse)}
                {society.status === 'suspended'
                  ? ` · ${translateResponse('Suspended')}`
                  : ''}
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
  label,
}: {
  onSignOut: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={onSignOut}
      variant="tertiary"
    >
      {label}
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
  const { locale, translate } = useLanguage();
  const t = (source: string, values?: MessageValues) =>
    translateAuthMessage(locale, source, values, translate);
  const translateResponse = (source: string) =>
    translateKnownAuthResponse(locale, source, translate);
  const { chooseSociety, notice, pending, signOut } = useSessionActions();
  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Society selection')}
        </p>
        <h1 className="text-heading font-semibold">
          {t('Choose your society')}
        </h1>
        <p className="text-body text-ink-muted">
          {t('You’re signed in as {name}. Choose where you want to continue.', {
            name: session.user.fullName,
          })}
        </p>
      </div>
      <ActionNotice state={notice} translateResponse={translateResponse} />
      <SocietyOptions
        onChoose={chooseSociety}
        pending={pending}
        selectedSocietyId={session.activeSocietyId}
        societies={activeSocieties}
        translateResponse={translateResponse}
      />
      <SignOutButton
        label={t('Sign out')}
        onSignOut={signOut}
        pending={pending}
      />
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
  const { locale, translate } = useLanguage();
  const t = (source: string, values?: MessageValues) =>
    translateAuthMessage(locale, source, values, translate);
  const translateResponse = (source: string) =>
    translateKnownAuthResponse(locale, source, translate);
  const { chooseSociety, notice, pending, signOut } = useSessionActions();
  const [showSocieties, setShowSocieties] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let lastUsed: string | null = null;
    try {
      lastUsed = window.localStorage.getItem(
        `homeish:last-place:${activeSociety.id}`,
      );
    } catch (error) {
      console.warn('Could not read the last Homeish place.', error);
    }
    router.replace(
      resolveStartingPlace(
        activeSociety.roles,
        session.startingPlace,
        lastUsed,
      ),
    );
  }, [activeSociety.id, activeSociety.roles, router, session.startingPlace]);

  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Signed in')}
        </p>
        <h1 className="text-heading font-semibold">{activeSociety.name}</h1>
        <p className="text-body text-ink-muted">
          {session.user.fullName} ·{' '}
          {roleLabel(activeSociety.roles, translateResponse)}
        </p>
      </div>
      {activeSociety.status === 'suspended' ? (
        <Banner tone="warning">
          <p>
            {t(
              'This society is suspended. You can view information, but actions may be unavailable.',
            )}
          </p>
        </Banner>
      ) : null}
      <ActionNotice state={notice} translateResponse={translateResponse} />
      {pendingSocieties.length > 0 ? (
        <section className="grid gap-space-2" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-body-strong">
            {t('Waiting for approval')}
          </h2>
          <p className="text-caption text-ink-muted">
            {pendingSocieties.map(({ name }) => name).join(', ')}
          </p>
        </section>
      ) : null}
      {activeSocieties.length > 1 ? (
        <section className="grid gap-space-3" aria-labelledby="switch-heading">
          <h2 id="switch-heading" className="text-body-strong">
            {t('Switch society')}
          </h2>
          {showSocieties ? (
            <SocietyOptions
              onChoose={chooseSociety}
              pending={pending}
              selectedSocietyId={session.activeSocietyId}
              societies={activeSocieties}
              translateResponse={translateResponse}
            />
          ) : (
            <Button
              disabled={pending}
              onClick={() => setShowSocieties(true)}
              variant="secondary"
            >
              {t('Choose another society')}
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
      {session.officerAssignments.length ? (
        <section className="grid gap-space-2">
          <h2 className="text-body-strong">
            {t('Returning officer assignments')}
          </h2>
          {session.officerAssignments.map((assignment) => (
            <Link
              key={assignment.election_id}
              className="text-brand underline"
              href={`/elections/${assignment.election_id}/officer`}
            >
              {assignment.title}
            </Link>
          ))}
        </section>
      ) : null}
      <SignOutButton
        label={t('Sign out')}
        onSignOut={signOut}
        pending={pending}
      />
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
  const { locale, translate } = useLanguage();
  const t = (source: string, values?: MessageValues) =>
    translateAuthMessage(locale, source, values, translate);
  const translateResponse = (source: string) =>
    translateKnownAuthResponse(locale, source, translate);
  const { notice, pending, signOut } = useSessionActions();
  const waiting = pendingSocieties.length > 0;
  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {waiting ? t('Waiting for approval') : t('No society access')}
        </p>
        <h1 className="text-heading font-semibold">
          {waiting
            ? t('Your request is pending')
            : t('No society is linked yet')}
        </h1>
        <p className="text-body text-ink-muted">
          {waiting
            ? t(
                'A society administrator will review your membership for {name}. You can sign in again later to check its status.',
                { name: session.user.fullName },
              )
            : t(
                'Ask your society administrator to invite {name} at this email address. Homeish does not allow open sign-up.',
                { name: session.user.fullName },
              )}
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
      {session.officerAssignments.length ? (
        <section className="grid gap-space-2">
          <h2 className="text-body-strong">
            {t('Returning officer assignments')}
          </h2>
          {session.officerAssignments.map((assignment) => (
            <Link
              key={assignment.election_id}
              className="text-brand underline"
              href={`/elections/${assignment.election_id}/officer`}
            >
              {assignment.title}
            </Link>
          ))}
        </section>
      ) : null}
      <ActionNotice state={notice} translateResponse={translateResponse} />
      <SignOutButton
        label={t('Sign out')}
        onSignOut={signOut}
        pending={pending}
      />
      {!waiting ? (
        <Link className="text-caption text-brand underline" href="/register">
          {t('Request access with a society code')}
        </Link>
      ) : null}
      <Link className="text-caption text-brand underline" href="/login">
        {t('Sign in with a different email')}
      </Link>
    </div>
  );
}
