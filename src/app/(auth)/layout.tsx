// Unauthenticated routes share a centered authentication shell.
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AuthShell } from '@/components/app-shells';
import { LanguageProvider } from '@/components/language-provider';
import { isLocale, LANGUAGE_PREFERENCE_COOKIE } from '@/core/i18n/locale';

export default async function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const storedLocale = (await cookies()).get(LANGUAGE_PREFERENCE_COOKIE)?.value;
  const initialLocale = isLocale(storedLocale) ? storedLocale : 'en';
  return (
    <LanguageProvider initialLocale={initialLocale} mode="device">
      <AuthShell>{children}</AuthShell>
    </LanguageProvider>
  );
}
