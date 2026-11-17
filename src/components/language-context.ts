// Share the active language without coupling generic controls to server actions.
'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '../core/i18n/locale';
import type { MessageValues } from '../core/i18n/messages';

export type LanguageChangeResult =
  | { status: 'saved' }
  | { status: 'cancelled' }
  | { status: 'failed'; referenceId?: string };

export type LanguageContextValue = {
  changeLocale: (locale: Locale) => Promise<LanguageChangeResult>;
  hindiAvailable: boolean;
  locale: Locale;
  pending: boolean;
  translate: (source: string, values?: MessageValues) => string;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useOptionalLanguage(): LanguageContextValue | null {
  return useContext(LanguageContext);
}

export function useLanguage(): LanguageContextValue {
  const value = useOptionalLanguage();
  if (!value) {
    throw new Error('Language controls must be inside a LanguageProvider.');
  }
  return value;
}
