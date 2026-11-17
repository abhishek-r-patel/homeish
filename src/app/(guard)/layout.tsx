// Guard route boundary with its action-home frame.
import type { ReactNode } from 'react';
import { GuardShell } from '@/components/app-shells';
import { HandledByControl } from '@/components/guards/handled-by-control';
import { LanguageProvider } from '@/components/language-provider';
import { getGuardDutyState } from '@/core/guards/operations';

export default async function GuardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const guardState = await getGuardDutyState();
  return (
    <LanguageProvider
      hindiEnabled={guardState.isHindiEnabled}
      initialLocale={guardState.languagePreference}
      mode="account"
    >
      <GuardShell>
        <HandledByControl state={guardState} />
        {children}
      </GuardShell>
    </LanguageProvider>
  );
}
