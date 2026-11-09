// Developer route boundary with its isolated dark shell.
import type { ReactNode } from 'react';
import { DeveloperShell } from '@/components/app-shells';

export default function DeveloperLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DeveloperShell>{children}</DeveloperShell>;
}
