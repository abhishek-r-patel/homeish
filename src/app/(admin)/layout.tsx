// Admin route boundary; the admin shell is added with its core screens.
import type { ReactNode } from 'react';

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
