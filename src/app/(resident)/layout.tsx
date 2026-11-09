// Resident route boundary with its responsive navigation shell.
import type { ReactNode } from 'react';
import { ResidentShell } from '@/components/app-shells';

export default function ResidentLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <ResidentShell>{children}</ResidentShell>;
}
