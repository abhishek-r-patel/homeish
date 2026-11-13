// Root document, metadata and global styles for all route groups.
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/sora';
import { createRequestId } from '@/core/errors';
import { logUnexpectedError } from '@/core/logging/error-logger';
import { getSavedFontPreference } from '@/core/members/operations';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Homeish',
};

// The font preference is cosmetic: failing to load it (for example while
// Supabase is unreachable) must not replace every page with the bare fallback.
async function loadFontPreference() {
  try {
    return await getSavedFontPreference();
  } catch (error) {
    // Next.js signals dynamic rendering and redirects by throwing; never swallow those.
    unstable_rethrow(error);
    void logUnexpectedError(error, {
      requestId: createRequestId(),
      route: 'root-layout',
      source: 'server',
      severity: 'warning',
    });
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const fontPreference = await loadFontPreference();
  return (
    <html data-font-preference={fontPreference ?? undefined} lang="en">
      <body>{children}</body>
    </html>
  );
}
