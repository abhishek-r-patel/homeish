// Accessible email and verification-code screens for society sign-in.
'use client';

import { useEffect, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  requestCodeAction,
  verifyCodeAction,
  type AuthActionState,
} from '../../app/(auth)/actions';
import { Banner } from '../ui/feedback';
import { Button } from '../ui/button';
import { TextInput } from '../ui/text-input';

type Screen = 'email' | 'code';

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const visible = local.length > 1 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function ActionMessage({ state }: { state: AuthActionState | null }) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'success' : 'danger'}>
      <p>{state.message}</p>
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          Reference ID: <code>{state.referenceId}</code>
        </p>
      ) : null}
    </Banner>
  );
}

export function SignInFlow({ returnTo }: { returnTo: string | null }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requestState, setRequestState] = useState<AuthActionState | null>(
    null,
  );
  const [verifyState, setVerifyState] = useState<AuthActionState | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    'send' | 'resend' | 'verify' | null
  >(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function updateCountdown() {
      setSecondsRemaining(
        Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)),
      );
    }

    updateCountdown();
    if (cooldownUntil <= Date.now()) return;

    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  function submitCodeRequest(
    event: FormEvent<HTMLFormElement>,
    action: 'send' | 'resend',
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPendingAction(action);
    setRequestState(null);
    startTransition(async () => {
      const result = await requestCodeAction(formData);
      setRequestState(result);
      setPendingAction(null);
      if (result.ok) {
        setEmail(
          String(formData.get('email') ?? '')
            .trim()
            .toLowerCase(),
        );
        setCode('');
        setVerifyState(null);
        setScreen('code');
        setCooldownUntil(Date.now() + 30_000);
      } else if (result.retryAfterSeconds) {
        setCooldownUntil(
          Math.max(cooldownUntil, Date.now() + result.retryAfterSeconds * 1000),
        );
      }
    });
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPendingAction('verify');
    setVerifyState(null);
    startTransition(async () => {
      const result = await verifyCodeAction(formData);
      setVerifyState(result);
      setPendingAction(null);
      if (result.ok) {
        router.replace(result.redirectTo ?? '/session');
        router.refresh();
      }
    });
  }

  function useDifferentEmail() {
    setScreen('email');
    setCode('');
    setRequestState(null);
    setVerifyState(null);
    setCooldownUntil(0);
  }

  return (
    <div className="grid gap-space-5">
      {screen === 'email' ? (
        <>
          <div className="grid gap-space-2">
            <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
              Sign in
            </p>
            <h1 className="text-heading font-semibold">Welcome to Homeish</h1>
            <p className="text-body text-ink-muted">
              Enter the email address your society invited. We’ll send a
              one-time code if it has access.
            </p>
          </div>
          <ActionMessage state={requestState} />
          <form
            className="grid gap-space-5"
            onSubmit={(event) => submitCodeRequest(event, 'send')}
          >
            <TextInput
              autoComplete="email"
              id="sign-in-email"
              label="Email address"
              maxLength={254}
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <input name="purpose" type="hidden" value="signin" />
            <Button
              disabled={isPending}
              loading={isPending && pendingAction === 'send'}
              type="submit"
            >
              Send code
            </Button>
          </form>
          <p className="text-caption text-ink-muted">
            We use your email only to confirm your sign-in. Account details are
            never shown to someone who is not signed in.
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-space-2">
            <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
              Verify your email
            </p>
            <h1 className="text-heading font-semibold">Enter your code</h1>
            <p className="text-body text-ink-muted">
              If this email has access, a six-digit code was sent to{' '}
              <strong className="break-all text-ink">{maskEmail(email)}</strong>
              .
            </p>
          </div>
          <ActionMessage state={requestState} />
          <ActionMessage state={verifyState} />
          <form className="grid gap-space-5" onSubmit={submitCode}>
            <input name="email" type="hidden" value={email} />
            {returnTo ? (
              <input name="returnTo" type="hidden" value={returnTo} />
            ) : null}
            <TextInput
              autoComplete="one-time-code"
              autoFocus
              id="sign-in-code"
              inputMode="numeric"
              label="Six-digit code"
              maxLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) =>
                setCode(
                  event.currentTarget.value.replace(/\D/g, '').slice(0, 6),
                )
              }
            />
            <Button
              disabled={isPending || code.length !== 6}
              loading={isPending && pendingAction === 'verify'}
              type="submit"
            >
              Verify code
            </Button>
          </form>
          <div className="grid gap-space-2">
            <p aria-live="polite" className="text-caption text-ink-muted">
              {secondsRemaining > 0
                ? `You can request another code in ${secondsRemaining} seconds.`
                : 'Didn’t receive the email? Check your spam folder, then request a new code.'}
            </p>
            <form onSubmit={(event) => submitCodeRequest(event, 'resend')}>
              <input name="email" type="hidden" value={email} />
              <input name="purpose" type="hidden" value="signin" />
              <Button
                disabled={isPending || secondsRemaining > 0}
                loading={isPending && pendingAction === 'resend'}
                type="submit"
                variant="secondary"
              >
                Resend code
              </Button>
            </form>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={useDifferentEmail}
              type="button"
              variant="tertiary"
            >
              Use a different email
            </Button>
          </div>
        </>
      )}
      <p className="text-center text-caption text-ink-muted">
        <Link className="underline underline-offset-2" href="/">
          Return to Homeish
        </Link>
      </p>
    </div>
  );
}
