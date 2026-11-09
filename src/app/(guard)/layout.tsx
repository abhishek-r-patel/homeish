// Guard route boundary; the gate shell is added with its core screens.
import type { ReactNode } from 'react';

export default function GuardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
