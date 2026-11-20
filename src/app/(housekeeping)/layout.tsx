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
  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={context.languagePreference}
      mode="account"
    >
      <Shell
        enabledModules={[...context.enabledModules]}
        showPettyCash={showPettyCash}
      >
        {children}
      </Shell>
    </LanguageProvider>
  );
}
