// Root document, metadata and global styles for all route groups.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/sora';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Homeish',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
