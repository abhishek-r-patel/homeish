// Admin route boundary with its responsive navigation shell.
import type { ReactNode } from 'react';
import { AdminShell, CommitteeShell } from '@/components/app-shells';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { AppError, createRequestId } from '@/core/errors';
import { LanguageProvider } from '@/components/language-provider';
import { getShellData } from '@/core/tenancy/shell-data';
import { switchPlaceAction, switchSocietyAction } from '@/app/(auth)/actions';
import { getAllowedQuickActions } from '@/core/home/workspace-operations';
import { getAuditHistoryAccess } from '@/core/audit/history';
import { PERMISSION_MAPS } from '@/core/permissions';

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await buildRequestContext(createRequestId());
  if (!context.roles.some((role) => role === 'admin' || role === 'committee')) {
    throw new AppError('FORBIDDEN');
  }
  const Shell = context.roles.includes('admin') ? AdminShell : CommitteeShell;
  const [shellData, quickActions, auditAccess] = await Promise.all([
    getShellData(context),
    getAllowedQuickActions(
      context,
      context.roles.includes('admin') ? 'admin' : 'committee',
    ),
    getAuditHistoryAccess(),
  ]);
  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={context.languagePreference}
      mode="account"
    >
      <Shell
        activeSocietyId={shellData.activeSocietyId ?? undefined}
        enabledModules={[...context.enabledModules]}
        permissionMaps={
          context.roles.includes('committee') && !auditAccess.canView
            ? {
                ...PERMISSION_MAPS,
                core: {
                  ...PERMISSION_MAPS.core,
                  'audit:read': [],
                },
              }
            : undefined
        }
        places={shellData.places}
        quickActions={quickActions}
        societies={shellData.societies}
        switchPlace={switchPlaceAction}
        switchSociety={switchSocietyAction}
      >
        {children}
      </Shell>
    </LanguageProvider>
  );
}
