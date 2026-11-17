// Supported interface languages and the separate signed-out device preference.
export const SUPPORTED_LOCALES = ['en', 'hi'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LANGUAGE_PREFERENCE_COOKIE = 'homeish-language-preference';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'hi';
}
