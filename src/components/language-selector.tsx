// Let signed-in users and signed-out visitors choose the interface language.
'use client';

import { useState } from 'react';
import { isLocale, SUPPORTED_LOCALES } from '../core/i18n/locale';
import { useLanguage } from './language-provider';

export function LanguageSelector() {
  const { changeLocale, hindiAvailable, locale, pending, translate } =
    useLanguage();
  const [feedback, setFeedback] = useState<{
    message: string;
    referenceId?: string;
    success: boolean;
  } | null>(null);
  const availableLocales = SUPPORTED_LOCALES.filter(
    (supportedLocale) => supportedLocale === 'en' || hindiAvailable,
  );

  async function selectLanguage(value: string) {
    if (!isLocale(value)) return;
    setFeedback(null);
    const result = await changeLocale(value);
    if (result.status === 'cancelled') return;
    setFeedback({
      message:
        result.status === 'saved'
          ? 'Language preference saved.'
          : 'The language could not be saved. Your previous choice is still active.',
      ...(result.status === 'failed' && result.referenceId
        ? { referenceId: result.referenceId }
        : {}),
      success: result.status === 'saved',
    });
  }

  return (
    <div className="grid gap-space-1">
      <label
        className="grid gap-space-1 text-caption text-ink-muted"
        htmlFor="language-preference"
      >
        {translate('Language')}
        <select
          aria-label={translate('Choose a language')}
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          disabled={pending}
          id="language-preference"
          onChange={(event) => void selectLanguage(event.currentTarget.value)}
          value={locale}
        >
          {availableLocales.map((supportedLocale) => (
            <option key={supportedLocale} value={supportedLocale}>
              {translate(supportedLocale === 'en' ? 'English' : 'Hindi')}
            </option>
          ))}
        </select>
      </label>
      {feedback ? (
        <p
          aria-live="polite"
          className={`text-caption ${feedback.success ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {translate(feedback.message)}
          {feedback.referenceId ? ` (${feedback.referenceId})` : ''}
        </p>
      ) : null}
    </div>
  );
}
