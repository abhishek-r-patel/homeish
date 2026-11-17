// Resolve a request's account language or its separate signed-out device choice.
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { AppError, createRequestId } from '../errors';
import { buildRequestContext } from '../tenancy/request-context';
import { isLocale, LANGUAGE_PREFERENCE_COOKIE, type Locale } from './locale';

async function getDeviceLocale(): Promise<Locale> {
  const value = (await cookies()).get(LANGUAGE_PREFERENCE_COOKIE)?.value;
  return isLocale(value) ? value : 'en';
}

export const getRequestLocale = cache(async (): Promise<Locale> => {
  try {
    const context = await buildRequestContext(createRequestId());
    return context.languagePreference === 'hi' && context.isHindiEnabled
      ? 'hi'
      : 'en';
  } catch (error) {
    if (
      error instanceof AppError &&
      ['UNAUTHENTICATED', 'SESSION_EXPIRED'].includes(error.code)
    ) {
      return getDeviceLocale();
    }
    throw error;
  }
});
