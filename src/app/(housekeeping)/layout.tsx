// Wrap inventory supervisor pages in the existing housekeeping navigation shell.
import type { ReactNode } from 'react';
import {
  HousekeepingShell,
  AdminShell,
  CommitteeShell,
} from '@/components/app-shells';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { createRequestId } from '@/core/errors';
import { authorizeRequest } from '@/core/permissions/authorize';
export default async function HousekeepingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'housekeeping',
    permission: 'stock:list',
  });
  const Shell = context.roles.includes('admin')
    ? AdminShell
    : context.roles.includes('committee')
      ? CommitteeShell
      : HousekeepingShell;
  return <Shell enabledModules={[...context.enabledModules]}>{children}</Shell>;
}
