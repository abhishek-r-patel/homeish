// Wrap housekeeping supervisor pages (inventory, request logging, daily checks) in one shell.
import type { ReactNode } from 'react';
import {
  HousekeepingShell,
  AdminShell,
  CommitteeShell,
} from '@/components/app-shells';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { createRequestId } from '@/core/errors';
import { isPettyCashCustodian } from '@/core/expense/operations';
import {
  authorizeRequest,
  type AuthorizationRequirement,
} from '@/core/permissions/authorize';
import { LanguageProvider } from '@/components/language-provider';
import { getShellData } from '@/core/tenancy/shell-data';
import { switchPlaceAction, switchSocietyAction } from '@/app/(auth)/actions';
import { getAllowedQuickActions } from '@/core/home/workspace-operations';
export default async function HousekeepingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await buildRequestContext(createRequestId());
  const inventory: AuthorizationRequirement = {
    moduleKey: 'housekeeping',
    permission: 'stock:list',
  };
  // Supervisors may use the request pages even when inventory is switched off.
  const requirements: AuthorizationRequirement[] = [
    inventory,
    { moduleKey: 'service_request', permission: 'request:log' },
    { moduleKey: 'service_request', permission: 'request:rounds' },
  ];
  const allowed = requirements.some((requirement) => {
    try {
      authorizeRequest(context, requirement);
      return true;
    } catch {
      return false;
    }
  });
  if (!allowed) authorizeRequest(context, inventory);
  const Shell = context.roles.includes('admin')
    ? AdminShell
    : context.roles.includes('committee')
      ? CommitteeShell
      : HousekeepingShell;
  const showPettyCash =
    Shell === HousekeepingShell && (await isPettyCashCustodian(context));
  const shellData = await getShellData(context);
  const quickActions = await getAllowedQuickActions(
    context,
    context.roles.includes('hk_supervisor')
      ? 'hk_supervisor'
      : context.roles.includes('admin')
        ? 'admin'
        : 'committee',
  );
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
        quickActions={quickActions}
        showPettyCash={showPettyCash}
        societies={shellData.societies}
        switchPlace={switchPlaceAction}
        switchSociety={switchSocietyAction}
      >
        {children}
      </Shell>
    </LanguageProvider>
  );
}
