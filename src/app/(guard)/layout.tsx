// Guard route boundary with its action-home frame.
import type { ReactNode } from 'react';
import { GuardShell } from '@/components/app-shells';

export default function GuardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <GuardShell>{children}</GuardShell>;
}
