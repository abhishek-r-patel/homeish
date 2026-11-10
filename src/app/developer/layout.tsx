// Developer route boundary with its isolated dark shell.
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppError, createRequestId } from '@/core/errors';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { DeveloperShell } from '@/components/app-shells';

export default async function DeveloperLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  let context;
  try {
    context = await buildRequestContext(createRequestId());
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'UNAUTHENTICATED' ||
        error.code === 'SESSION_EXPIRED' ||
        error.code === 'MFA_REQUIRED')
    ) {
      redirect('/developer/login');
    }
    throw error;
  }
  if (!context.isDeveloper || !context.mfaVerified) {
    redirect('/developer/login');
  }
  return <DeveloperShell>{children}</DeveloperShell>;
}
