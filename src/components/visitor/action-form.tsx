// Show server-action validation and status feedback beside visitor forms.
'use client';

import Image from 'next/image';
import { useCallback, useRef, useState, useTransition } from 'react';
import type { ReactNode, FormEvent } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import { CodeDisplay } from '@/components/ui/data-display';
import { QrScanner } from './qr-scanner';

export type VisitorFormAction = (
  formData: FormData,
) => Promise<ServerActionResult<unknown>>;

type VisitorApprovalView = {
  code: string;
  qrCode: string;
  timezone?: string;
  valid_to?: string;
  visitor_name?: string;
};

function isVisitorApprovalView(value: unknown): value is VisitorApprovalView {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'qrCode' in value &&
    typeof value.qrCode === 'string' &&
    (!('visitor_name' in value) || typeof value.visitor_name === 'string') &&
    (!('valid_to' in value) || typeof value.valid_to === 'string') &&
    (!('timezone' in value) || typeof value.timezone === 'string')
  );
}

export function VisitorActionForm({
  action,
  children,
  className,
  requestIdStorageKey,
}: {
  action: VisitorFormAction;
  children: ReactNode;
  className?: string;
  requestIdStorageKey?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [pending, startTransition] = useTransition();
  const approval =
    result?.ok && isVisitorApprovalView(result.data) ? result.data : null;

  function startAnotherEntry() {
    try {
      if (requestIdStorageKey) sessionStorage.removeItem(requestIdStorageKey);
      formRef.current?.reset();
      setResult(null);
      setFormMessage(null);
      setCompleted(false);
    } catch {
      setFormMessage(
        'Could not clear the saved retry key. Refresh the page before creating another entry.',
      );
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completed) {
      setFormMessage('This visitor entry is already saved. Start a new entry.');
      return;
    }
    const formData = new FormData(event.currentTarget);
    if (formData.get('photoUploadPending') === 'true') {
      setFormMessage('Wait for the visitor photo upload to finish.');
      return;
    }
    if (requestIdStorageKey && formData.has('clientRequestId')) {
      try {
        const requestId =
          sessionStorage.getItem(requestIdStorageKey) ?? crypto.randomUUID();
        sessionStorage.setItem(requestIdStorageKey, requestId);
        formData.set('clientRequestId', requestId);
      } catch {
        setFormMessage(
          'Could not safely prepare the visitor request. Check browser storage and retry.',
        );
        return;
      }
    }
    setFormMessage(null);
    startTransition(async () => {
      try {
        const actionResult = await action(formData);
        setResult(actionResult);
        if (actionResult.ok && requestIdStorageKey) {
          setCompleted(true);
          try {
            sessionStorage.removeItem(requestIdStorageKey);
          } catch {
            setFormMessage(
              'The request was saved, but its retry key could not be cleared. Do not submit this entry again.',
            );
          }
        }
      } catch {
        setFormMessage(
          'Could not reach the server. Your details remain here; reconnect and retry.',
        );
      }
    });
  }

  return (
    <form className={className} onSubmit={submit} ref={formRef}>
      {children}
      {completed ? (
        <button
          className="min-h-12 w-fit rounded-md border border-rule-strong px-space-4 font-semibold"
          onClick={startAnotherEntry}
          type="button"
        >
          Log another visitor
        </button>
      ) : null}
      {formMessage ? (
        <p
          aria-live="polite"
          className="text-caption text-danger"
          role="status"
        >
          {formMessage}
        </p>
      ) : null}
      {result ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-ink-muted' : 'text-danger'}`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
      {approval ? (
        <CodeDisplay
          label={`Entry code for ${approval.visitor_name ?? 'visitor'}`}
          qrCode={
            <Image
              alt="QR code for the visitor entry code"
              height={192}
              src={approval.qrCode}
              unoptimized
              width={192}
            />
          }
          singleUse
          validity={
            approval.valid_to
              ? `Valid until ${new Date(approval.valid_to).toLocaleString(
                  undefined,
                  approval.timezone
                    ? { timeZone: approval.timezone }
                    : undefined,
                )}`
              : undefined
          }
          value={approval.code}
        />
      ) : null}
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? 'Working…' : ''}
      </span>
    </form>
  );
}

export function VisitorCodeControl({
  checkInAction,
  validateAction,
}: {
  checkInAction: VisitorFormAction;
  validateAction: VisitorFormAction;
}) {
  const [code, setCode] = useState('');
  const [validation, setValidation] =
    useState<ServerActionResult<unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const acceptScannedCode = useCallback((rawCode: string) => {
    setCode(rawCode);
    setValidation(null);
    setScanning(false);
  }, []);
  const data =
    validation?.ok && validation.data && typeof validation.data === 'object'
      ? validation.data
      : null;
  const reason =
    data && 'reason' in data && typeof data.reason === 'string'
      ? data.reason
      : null;
  const visitorName =
    data && 'visitor_name' in data && typeof data.visitor_name === 'string'
      ? data.visitor_name
      : null;
  const unitLabel =
    data && 'unit_label' in data && typeof data.unit_label === 'string'
      ? data.unit_label
      : null;
  const validFrom =
    data && 'valid_from' in data && typeof data.valid_from === 'string'
      ? data.valid_from
      : null;
  const validTo =
    data && 'valid_to' in data && typeof data.valid_to === 'string'
      ? data.valid_to
      : null;
  const timezone =
    data && 'timezone' in data && typeof data.timezone === 'string'
      ? data.timezone
      : 'UTC';

  function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set('code', code);
    startTransition(async () => {
      setMessage(null);
      setValidation(await validateAction(formData));
    });
  }

  function checkIn() {
    const formData = new FormData();
    formData.set('code', code);
    startTransition(async () => {
      const result = await checkInAction(formData);
      setMessage(
        result.message ??
          (result.ok ? 'Visitor checked in.' : 'Check-in failed.'),
      );
      if (result.ok) {
        setCode('');
        setValidation(null);
      }
    });
  }

  return (
    <div className="grid gap-space-3">
      <form className="grid gap-space-3" onSubmit={validate}>
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="visitor-code"
        >
          Visitor code
          <input
            autoComplete="one-time-code"
            className="min-h-12 rounded-md border border-rule px-space-3 text-center text-title tracking-[0.3em]"
            id="visitor-code"
            inputMode="numeric"
            maxLength={6}
            minLength={6}
            onChange={(event) => {
              setCode(event.currentTarget.value);
              setValidation(null);
            }}
            pattern="[0-9]{6}"
            required
            value={code}
          />
        </label>
        <button
          className="min-h-14 rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
          disabled={pending}
          type="submit"
        >
          Check code
        </button>
      </form>
      <button
        className="min-h-12 w-fit rounded-md border border-rule-strong px-space-3 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
        onClick={() => setScanning((value) => !value)}
        type="button"
      >
        {scanning ? 'Stop camera' : 'Scan QR code'}
      </button>
      <QrScanner active={scanning} onCode={acceptScannedCode} />
      {validation ? (
        <p
          aria-live="polite"
          className={`text-body ${validation.ok && reason === 'valid' ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {validation.ok && reason === 'valid'
            ? `Valid pre-approval for ${visitorName ?? 'visitor'}.`
            : reason === 'expired'
              ? 'This visitor code has expired.'
              : reason === 'already_used'
                ? 'This visitor code has already been used.'
                : validation.ok
                  ? 'This visitor code is invalid.'
                  : validation.message}
        </p>
      ) : null}
      {validation?.ok && reason === 'valid' ? (
        <>
          <div className="grid gap-space-1 text-caption text-ink-muted">
            {unitLabel ? <p>Unit: {unitLabel}</p> : null}
            {validFrom && validTo ? (
              <p>
                Valid{' '}
                {new Date(validFrom).toLocaleString(undefined, {
                  timeZone: timezone,
                })}
                {' – '}
                {new Date(validTo).toLocaleString(undefined, {
                  timeZone: timezone,
                })}
              </p>
            ) : null}
          </div>
          <button
            className="min-h-14 rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
            disabled={pending}
            onClick={checkIn}
            type="button"
          >
            Check in visitor
          </button>
        </>
      ) : null}
      {message ? (
        <p
          aria-live="polite"
          className="text-body text-ink-muted"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
