// Resident route boundary with its responsive navigation shell.
import type { ReactNode } from 'react';
import { ResidentShell } from '@/components/app-shells';
import { LanguageProvider } from '@/components/language-provider';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { createRequestId } from '@/core/errors';
import { isPettyCashCustodian } from '@/core/expense/operations';

export default async function ResidentLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await buildRequestContext(createRequestId());
  const showPettyCash = await isPettyCashCustodian(context);
  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={context.languagePreference}
      mode="account"
    >
      <ResidentShell
        enabledModules={[...context.enabledModules]}
        showPettyCash={showPettyCash}
      >
        {children}
      </ResidentShell>
    </LanguageProvider>
  );
}
