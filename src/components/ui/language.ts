// Translate fixed shared-control copy while leaving optional language contexts optional.
'use client';

import { useOptionalLanguage } from '../language-context';
import {
  translateFeedbackMessage,
  type MessageValues,
} from '../../core/i18n/messages';
import { HI_UI } from '../../core/i18n/catalogs/hi-ui';

function interpolate(message: string, values?: MessageValues) {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values?.[key];
    if (value === undefined) {
      throw new Error(`Missing interpolation value "${key}" for: ${message}`);
    }
    return String(value);
  });
}

export function useUiTranslator() {
  const language = useOptionalLanguage();

  return {
    locale: language?.locale ?? null,
    translateFeedback(source: string) {
      return translateFeedbackMessage(language?.locale ?? 'en', source);
    },
    translate(source: string, values?: MessageValues) {
      if (!language) return interpolate(source, values);
      if (language.locale === 'en') return language.translate(source, values);
      const message = Object.hasOwn(HI_UI, source) ? HI_UI[source] : undefined;
      return message === undefined
        ? language.translate(source, values)
        : interpolate(message, values);
    },
  };
}
