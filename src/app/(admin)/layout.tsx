// Admin route boundary with its responsive navigation shell.
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/app-shells';

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
