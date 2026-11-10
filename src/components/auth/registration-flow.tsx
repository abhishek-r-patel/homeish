// Guide a resident through code lookup, email verification, and approval.
'use client';

import { useEffect, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestCodeAction,
  verifyCodeAction,
  type AuthActionState,
} from '@/app/(auth)/actions';
import {
  lookupSocietyAction,
  submitRegistrationAction,
} from '@/app/(auth)/register/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { RegistrationSociety } from '@/core/registration/operations';
import { Banner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';

type Screen = 'lookup' | 'details' | 'verify';

function Feedback({
  result,
}: {
  result:
    | AuthActionState
    | ServerActionResult<RegistrationSociety | null>
    | ServerActionResult
    | null;
}) {
  if (!result) return null;
  return (
    <Banner tone={result.ok ? 'success' : 'danger'}>
      <p>{result.message ?? 'The request could not be completed.'}</p>
      {!result.ok && result.fieldErrors ? (
        <p>{Object.values(result.fieldErrors).join(' ')}</p>
      ) : null}
    </Banner>
  );
}

export function RegistrationFlow() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('lookup');
  const [joinCode, setJoinCode] = useState('');
  const [society, setSociety] = useState<RegistrationSociety | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState('');
  const [relationship, setRelationship] = useState('owner');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [result, setResult] = useState<
    | AuthActionState
    | ServerActionResult<RegistrationSociety | null>
    | ServerActionResult
    | null
  >(null);
  const [pending, startTransition] = useTransition();

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

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = String(formData.get('joinCode') ?? '')
      .trim()
      .toUpperCase();
    setJoinCode(value);
    setResult(null);
    setNotice(null);
    startTransition(async () => {
      const response = await lookupSocietyAction(value);
      if (response.ok && response.data) {
        setResult(null);
        setSociety(response.data);
        setUnitId(response.data.units[0]?.id ?? '');
        setScreen('details');
      } else if (response.ok) {
        setResult(null);
        setNotice('No society matched that code. Check it and try again.');
      } else {
        setResult(response);
      }
    });
  }

  function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const response = await requestCodeAction(formData);
      setResult(response);
      if (response.ok) {
        setEmail(
          String(formData.get('email') ?? '')
            .trim()
            .toLowerCase(),
        );
        setCooldownUntil(Date.now() + 30_000);
        setScreen('verify');
      } else if (response.retryAfterSeconds) {
        setCooldownUntil(Date.now() + response.retryAfterSeconds * 1000);
      }
    });
  }

  function resendCode() {
    const formData = new FormData();
    formData.set('email', email);
    formData.set('purpose', 'register');
    formData.set('joinCode', joinCode);
    setResult(null);
    startTransition(async () => {
      const response = await requestCodeAction(formData);
      setResult(response);
      if (response.ok) {
        setCooldownUntil(Date.now() + 30_000);
      } else if (response.retryAfterSeconds) {
        setCooldownUntil(Date.now() + response.retryAfterSeconds * 1000);
      }
    });
  }

  function verifyAndSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const verification = await verifyCodeAction(formData);
      setResult(verification);
      if (!verification.ok) return;

      const registration = new FormData();
      registration.set('joinCode', joinCode);
      registration.set('unitId', unitId);
      registration.set('fullName', fullName);
      registration.set('relationship', relationship);
      const submission = await submitRegistrationAction(registration);
      setResult(submission);
      if (submission.ok) {
        router.replace('/session');
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          S-04 · Self-registration
        </p>
        <h1 className="text-heading font-semibold">
          {screen === 'verify' ? 'Verify your email' : 'Request society access'}
        </h1>
        <p className="text-body text-ink-muted">
          {screen === 'verify'
            ? `Enter the six-digit code sent to ${email}.`
            : 'Use the join code shared by your society administrator. Your request will need approval.'}
        </p>
      </div>
      {notice ? (
        <Banner tone="warning">
          <p>{notice}</p>
        </Banner>
      ) : null}
      <Feedback result={result} />

      {screen === 'lookup' ? (
        <form className="grid gap-space-4" onSubmit={lookup}>
          <TextInput
            autoComplete="off"
            id="registration-join-code"
            label="Society join code"
            maxLength={8}
            name="joinCode"
            required
            value={joinCode}
            onChange={(event) =>
              setJoinCode(event.currentTarget.value.toUpperCase())
            }
          />
          <Button disabled={pending} loading={pending} type="submit">
            Find society
          </Button>
        </form>
      ) : null}

      {screen === 'details' && society ? (
        <div className="grid gap-space-4">
          <section aria-label="Society" className="grid gap-space-1">
            <p className="text-caption text-ink-muted">Society</p>
            <p className="text-body-strong">{society.societyName}</p>
          </section>
          {society.units.length > 0 ? (
            <form className="grid gap-space-4" onSubmit={requestCode}>
              <TextInput
                autoComplete="name"
                id="registration-full-name"
                label="Full name"
                maxLength={120}
                name="fullName"
                required
                value={fullName}
                onChange={(event) => setFullName(event.currentTarget.value)}
              />
              <TextInput
                autoComplete="email"
                id="registration-email"
                label="Email address"
                maxLength={254}
                name="email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
              <input name="purpose" type="hidden" value="register" />
              <input name="joinCode" type="hidden" value={joinCode} />
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="registration-unit"
              >
                Unit
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
                  id="registration-unit"
                  name="unitId"
                  onChange={(event) => setUnitId(event.currentTarget.value)}
                  required
                  value={unitId}
                >
                  {society.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.blockName ? `${unit.blockName} · ` : ''}
                      {unit.number}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="grid gap-space-1 text-body-strong"
                htmlFor="registration-relationship"
              >
                Relationship
                <select
                  className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink"
                  id="registration-relationship"
                  name="relationship"
                  onChange={(event) =>
                    setRelationship(event.currentTarget.value)
                  }
                  value={relationship}
                >
                  <option value="owner">Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="family">Family</option>
                </select>
              </label>
              <Button disabled={pending} loading={pending} type="submit">
                Send verification code
              </Button>
              <Button
                disabled={pending}
                onClick={() => setScreen('lookup')}
                type="button"
                variant="tertiary"
              >
                Use a different code
              </Button>
            </form>
          ) : (
            <p className="text-body text-ink-muted">
              This society has no active units available for registration. Ask
              an administrator for help.
            </p>
          )}
        </div>
      ) : null}

      {screen === 'verify' ? (
        <form className="grid gap-space-4" onSubmit={verifyAndSubmit}>
          <input name="email" type="hidden" value={email} />
          <input name="purpose" type="hidden" value="register" />
          <input name="joinCode" type="hidden" value={joinCode} />
          <TextInput
            autoComplete="one-time-code"
            autoFocus
            id="registration-verification-code"
            inputMode="numeric"
            label="Six-digit code"
            maxLength={6}
            name="code"
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(event) =>
              setCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))
            }
          />
          <Button
            disabled={pending || code.length !== 6}
            loading={pending}
            type="submit"
          >
            Verify and request access
          </Button>
          <Button
            disabled={pending}
            onClick={() => setScreen('details')}
            type="button"
            variant="tertiary"
          >
            Use a different email
          </Button>
          <div className="grid gap-space-2">
            <p aria-live="polite" className="text-caption text-ink-muted">
              {secondsRemaining > 0
                ? `You can request another code in ${secondsRemaining} seconds.`
                : 'Didn’t receive the code? Check your spam folder before requesting another.'}
            </p>
            <Button
              disabled={pending || secondsRemaining > 0}
              onClick={resendCode}
              type="button"
              variant="secondary"
            >
              Resend code
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
