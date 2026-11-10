// Root document, metadata and global styles for all route groups.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/sora';
import { getSavedFontPreference } from '@/core/members/operations';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Homeish',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const fontPreference = await getSavedFontPreference();
  return (
    <html data-font-preference={fontPreference ?? undefined} lang="en">
      <body>{children}</body>
    </html>
  );
}
