// Let society admins allow Hindi and show committees the current availability.
'use client';

import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updateHindiAvailabilityAction } from '@/app/(admin)/admin/settings/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { useLanguage } from '@/components/language-provider';
import type { MessageValues } from '@/core/i18n/messages';

type HindiAvailability = { hindiAvailable: boolean; version: string };
type ActionResult = ServerActionResult<HindiAvailability>;
type HindiAvailabilityDraft = {
  sourceHindiAvailable: boolean;
  sourceVersion: string;
  baselineHindiAvailable: boolean;
  hindiAvailable: boolean;
  version: string;
};

function getResultMessage(
  result: ActionResult,
  translate: (source: string, values?: MessageValues) => string,
) {
  if (result.ok) return translate('Language settings saved.');
  if (result.code === 'CONFLICT') {
    return translate(
      'These settings changed. Reload them before saving again.',
    );
  }
  if (result.code === 'MODULE_DISABLED') {
    return translate(
      'Language Support was turned off. Hindi is no longer available.',
    );
  }
  if (result.code === 'FORBIDDEN') {
    return translate("You don't have permission to change this setting.");
  }
  if (result.code === 'SOCIETY_SUSPENDED') {
    return translate('This society is read-only. The setting was not changed.');
  }
  return translate(
    'The language setting could not be saved. Your selection is still on this page.',
  );
}

export function LanguageSettingsControls({
  canManage,
  initialHindiAvailable,
  initialVersion,
}: {
  canManage: boolean;
  initialHindiAvailable: boolean;
  initialVersion: string;
}) {
  const router = useRouter();
  const { translate } = useLanguage();
  const [draft, setDraft] = useState<HindiAvailabilityDraft>({
    sourceHindiAvailable: initialHindiAvailable,
    sourceVersion: initialVersion,
    baselineHindiAvailable: initialHindiAvailable,
    hindiAvailable: initialHindiAvailable,
    version: initialVersion,
  });
  if (
    draft.sourceHindiAvailable !== initialHindiAvailable ||
    draft.sourceVersion !== initialVersion
  ) {
    setDraft({
      sourceHindiAvailable: initialHindiAvailable,
      sourceVersion: initialVersion,
      baselineHindiAvailable: initialHindiAvailable,
      hindiAvailable: initialHindiAvailable,
      version: initialVersion,
    });
  }
  const { hindiAvailable, version } = draft;
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set('hindiAvailable', String(hindiAvailable));
    formData.set('expectedVersion', version);
    setResult(null);
    startTransition(async () => {
      const nextResult = await updateHindiAvailabilityAction(formData);
      if (nextResult.ok) {
        const settings = nextResult.data;
        if (!settings) {
          setResult({
            ok: false,
            code: 'INTERNAL_ERROR',
            message: 'The language setting update returned no data.',
          });
          return;
        }
        setResult(nextResult);
        setDraft((current) => ({
          ...current,
          baselineHindiAvailable: settings.hindiAvailable,
          hindiAvailable: settings.hindiAvailable,
          version: settings.version,
        }));
        return;
      }
      setResult(nextResult);
    });
  }

  if (!canManage) {
    return (
      <p className="text-body text-ink">
        {translate(
          hindiAvailable
            ? 'Hindi is allowed in this society.'
            : 'Hindi is not allowed in this society. Members will see English.',
        )}
      </p>
    );
  }

  const isDirty = hindiAvailable !== draft.baselineHindiAvailable;

  return (
    <form className="grid gap-space-3" onSubmit={submit}>
      <CheckboxInput
        checked={hindiAvailable}
        description={translate(
          'Turning this off keeps saved language preferences unchanged.',
        )}
        id="hindi-availability"
        label={translate('Allow Hindi in this society')}
        onChange={(event) => {
          const nextHindiAvailable = event.currentTarget.checked;
          setDraft((current) => ({
            ...current,
            hindiAvailable: nextHindiAvailable,
          }));
        }}
      />
      <Button disabled={pending || !isDirty} loading={pending} type="submit">
        {translate('Save language settings')}
      </Button>
      {result ? (
        <div className="grid justify-items-start gap-space-2">
          <p
            aria-live="polite"
            className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
            role="status"
          >
            {getResultMessage(result, translate)}
            {!result.ok && result.referenceId
              ? ` ${translate('Reference ID: {referenceId}', {
                  referenceId: result.referenceId,
                })}`
              : ''}
          </p>
          {!result.ok &&
          (result.code === 'CONFLICT' || result.code === 'MODULE_DISABLED') ? (
            <Button
              onClick={() => router.refresh()}
              type="button"
              variant="secondary"
            >
              {translate('Reload settings')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
