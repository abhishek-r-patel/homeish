// Password and authenticator flow for the isolated developer console.
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  developerSignInAction,
  developerVerifyMfaAction,
  type AuthActionState,
} from '../../app/(auth)/actions';
import { Banner } from '../ui/feedback';
import { Button } from '../ui/button';
import { TextInput } from '../ui/text-input';

type DeveloperStep =
  | { step: 'credentials' }
  | { step: 'verify' }
  | { step: 'enroll'; qrCode: string; secret: string };

function ActionNotice({ state }: { state: AuthActionState | null }) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'info' : 'danger'}>
      <p>
        {state.message ??
          (state.ok
            ? 'Continue with the authenticator step.'
            : 'Could not complete developer sign-in.')}
      </p>
      {!state.ok && state.retryAfterSeconds ? (
        <p className="mt-space-2 text-caption">
          Try again in {state.retryAfterSeconds} seconds.
        </p>
      ) : null}
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          Reference ID: <code>{state.referenceId}</code>
        </p>
      ) : null}
    </Banner>
  );
}

export function DeveloperSignInFlow() {
  const router = useRouter();
  const [step, setStep] = useState<DeveloperStep>({ step: 'credentials' });
  const [state, setState] = useState<AuthActionState | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState(null);
    setLocalError(null);
    startTransition(async () => {
      const result = await developerSignInAction(formData);
      setState(result);
      if (!result.ok) return;
      if (!result.developer) {
        setLocalError('The developer verification step was not returned.');
        return;
      }
      setStep(result.developer);
    });
  }

  function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState(null);
    setLocalError(null);
    startTransition(async () => {
      const result = await developerVerifyMfaAction(formData);
      setState(result);
      if (result.ok) {
        router.replace(result.redirectTo ?? '/developer');
        router.refresh();
      }
    });
  }

  return (
    <section className="w-full overflow-hidden rounded-lg border border-rule bg-surface shadow-card">
      <header className="bg-ink px-space-5 py-space-4 text-surface">
        <p className="text-caption font-semibold uppercase tracking-wide">
          Developer Console
        </p>
      </header>
      <div className="grid gap-space-5 p-space-5">
        <div className="grid gap-space-2">
          <h1 className="text-heading font-semibold">
            {step.step === 'credentials'
              ? 'Developer sign in'
              : step.step === 'enroll'
                ? 'Set up your authenticator'
                : 'Verify your authenticator'}
          </h1>
          <p className="text-body text-ink-muted">
            {step.step === 'credentials'
              ? 'Use your developer account password, then complete the second-factor check.'
              : step.step === 'enroll'
                ? 'Scan the QR code with an authenticator app, or enter the setup key manually.'
                : 'Enter the current six-digit code from your authenticator app.'}
          </p>
        </div>
        <ActionNotice state={state} />
        {localError ? (
          <Banner tone="danger">
            <p>{localError}</p>
          </Banner>
        ) : null}

        {step.step === 'credentials' ? (
          <form className="grid gap-space-5" onSubmit={submitCredentials}>
            <TextInput
              autoComplete="username"
              id="developer-email"
              label="Developer email"
              maxLength={254}
              name="email"
              required
              type="email"
            />
            <TextInput
              autoComplete="current-password"
              id="developer-password"
              label="Password"
              maxLength={256}
              name="password"
              required
              type="password"
            />
            <Button disabled={isPending} loading={isPending} type="submit">
              Continue
            </Button>
          </form>
        ) : (
          <form className="grid gap-space-5" onSubmit={submitMfa}>
            {step.step === 'enroll' ? (
              <div className="grid justify-items-center gap-space-3">
                <Image
                  alt="QR code for adding the Homeish Developer Console to an authenticator app"
                  className="rounded-md border border-rule bg-surface p-space-2"
                  height={220}
                  src={step.qrCode}
                  unoptimized
                  width={220}
                />
                <p className="w-full break-all rounded-md bg-surface-sunken p-space-3 font-mono text-caption">
                  {step.secret}
                </p>
              </div>
            ) : null}
            <TextInput
              autoComplete="one-time-code"
              autoFocus
              id="developer-mfa-code"
              inputMode="numeric"
              label="Authenticator code"
              maxLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
            />
            <Button disabled={isPending} loading={isPending} type="submit">
              {step.step === 'enroll' ? 'Verify and finish setup' : 'Verify'}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
