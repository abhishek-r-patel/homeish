// Show and update the signed shared-account guard identity.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { identifyGuardAction } from '@/app/(guard)/actions';
import type { GuardDutyState } from '@/core/guards/operations';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Banner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';

export function HandledByControl({ state }: { state: GuardDutyState }) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [editing, setEditing] = useState(!state.currentGuard);
  const [message, setMessage] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  if (state.mode === 'individual') return null;

  function submit(formData: FormData) {
    const guardId = formData.get('guardId');
    const pin = formData.get('pin');
    if (typeof guardId !== 'string') return;
    startTransition(async () => {
      const result = await identifyGuardAction({
        guardId,
        ...(typeof pin === 'string' && pin ? { pin } : {}),
      });
      setMessage(result);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-label={t('Guard on duty')}
      className="mb-space-4 grid gap-space-3 rounded-lg border border-brand/30 bg-brand-tint p-space-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-space-3">
        <p className="text-body-strong">
          {t('Handled by')}:{' '}
          <span className="font-normal">
            {state.currentGuard?.name ?? t('Not identified')}
          </span>
        </p>
        {state.currentGuard && !editing ? (
          <Button
            onClick={() => {
              setMessage(null);
              setEditing(true);
            }}
            variant="secondary"
          >
            {t('Switch guard')}
          </Button>
        ) : null}
      </div>
      {message ? (
        <Banner tone={message.ok ? 'success' : 'danger'}>
          <p>{message.message ? translateFeedback(message.message) : null}</p>
          {!message.ok && message.referenceId ? (
            <p className="mt-space-2 text-caption">
              {t('Reference ID')}: <code>{message.referenceId}</code>
            </p>
          ) : null}
          {!message.ok && message.retryAfterSeconds ? (
            <p className="mt-space-2 text-caption">
              {t('Try again in {seconds} seconds.', {
                seconds: message.retryAfterSeconds,
              })}
            </p>
          ) : null}
        </Banner>
      ) : null}
      {editing ? (
        state.guards.length > 0 ? (
          <form action={submit} className="grid gap-space-3">
            <label className="grid gap-space-1 text-body-strong">
              {t('Guard name')}
              <select
                className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body"
                name="guardId"
                required
              >
                <option value="">{t('Choose your name')}</option>
                {state.guards.map((guard) => (
                  <option key={guard.id} value={guard.id}>
                    {guard.name}
                  </option>
                ))}
              </select>
            </label>
            {state.identification === 'pin' ? (
              <TextInput
                autoComplete="current-password"
                id="guard-duty-pin"
                inputMode="numeric"
                label={t('Personal PIN')}
                maxLength={6}
                name="pin"
                pattern="[0-9]{4,6}"
                required
                type="password"
              />
            ) : null}
            <Button disabled={pending} type="submit">
              {t('Confirm who is on duty')}
            </Button>
          </form>
        ) : (
          <p className="text-caption text-ink-muted">
            {t('Ask an administrator to add guards to the roster.')}
          </p>
        )
      ) : null}
    </section>
  );
}
