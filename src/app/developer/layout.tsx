// Developer route boundary; its isolated shell is added with the developer console.
import type { ReactNode } from 'react';

export default function DeveloperLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
