// Guard route boundary with its action-home frame.
import type { ReactNode } from 'react';
import { GuardShell } from '@/components/app-shells';
import { HandledByControl } from '@/components/guards/handled-by-control';
import { getGuardDutyState } from '@/core/guards/operations';

export default async function GuardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const guardState = await getGuardDutyState();
  return (
    <GuardShell>
      <HandledByControl state={guardState} />
      {children}
    </GuardShell>
  );
}
