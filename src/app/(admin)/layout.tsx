// Admin route boundary with its responsive navigation shell.
import type { ReactNode } from 'react';
import { AdminShell, CommitteeShell } from '@/components/app-shells';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { AppError, createRequestId } from '@/core/errors';
import { LanguageProvider } from '@/components/language-provider';
import { getShellData } from '@/core/tenancy/shell-data';
import { switchSocietyAction } from '@/app/(auth)/actions';

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await buildRequestContext(createRequestId());
  if (!context.roles.some((role) => role === 'admin' || role === 'committee')) {
    throw new AppError('FORBIDDEN');
  }
  const Shell = context.roles.includes('admin') ? AdminShell : CommitteeShell;
  const shellData = await getShellData(context);
  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={context.languagePreference}
      mode="account"
    >
      <Shell
        activeSocietyId={shellData.activeSocietyId ?? undefined}
        enabledModules={[...context.enabledModules]}
        places={shellData.places}
        societies={shellData.societies}
        switchSociety={switchSocietyAction}
      >
        {children}
      </Shell>
    </LanguageProvider>
  );
}
