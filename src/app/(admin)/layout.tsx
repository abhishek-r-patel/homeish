// Admin route boundary with its responsive navigation shell.
import type { ReactNode } from 'react';
import { AdminShell, CommitteeShell } from '@/components/app-shells';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { AppError, createRequestId } from '@/core/errors';

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await buildRequestContext(createRequestId());
  if (!context.roles.some((role) => role === 'admin' || role === 'committee')) {
    throw new AppError('FORBIDDEN');
  }
  const Shell = context.roles.includes('admin') ? AdminShell : CommitteeShell;
  return <Shell enabledModules={[...context.enabledModules]}>{children}</Shell>;
}
