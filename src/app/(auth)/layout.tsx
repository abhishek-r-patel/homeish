// Unauthenticated route boundary; the sign-in flow is added in the core phase.
import type { ReactNode } from 'react';

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
