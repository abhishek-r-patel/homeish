// Unauthenticated routes share a centered authentication shell.
import type { ReactNode } from 'react';
import { AuthShell } from '@/components/app-shells';

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AuthShell>{children}</AuthShell>;
}
