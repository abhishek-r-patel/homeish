// Guard route boundary with its action-home frame.
import type { ReactNode } from 'react';
import { GuardShell } from '@/components/app-shells';
import { HandledByControl } from '@/components/guards/handled-by-control';
import { LanguageProvider } from '@/components/language-provider';
import { getGuardDutyState } from '@/core/guards/operations';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { createRequestId } from '@/core/errors';
import { getShellData } from '@/core/tenancy/shell-data';
import { switchSocietyAction } from '@/app/(auth)/actions';
import { getAllowedQuickActions } from '@/core/home/workspace-operations';

export default async function GuardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const guardState = await getGuardDutyState();
  const context = await buildRequestContext(createRequestId());
  const [shellData, quickActions] = await Promise.all([
    getShellData(context),
    getAllowedQuickActions(context, 'guard'),
  ]);
  return (
    <LanguageProvider
      hindiEnabled={guardState.isHindiEnabled}
      initialLocale={guardState.languagePreference}
      mode="account"
    >
      <GuardShell
        activeSocietyId={shellData.activeSocietyId ?? undefined}
        places={shellData.places}
        quickActions={quickActions}
        societies={shellData.societies}
        switchSociety={switchSocietyAction}
      >
        <HandledByControl state={guardState} />
        {children}
      </GuardShell>
    </LanguageProvider>
  );
}
