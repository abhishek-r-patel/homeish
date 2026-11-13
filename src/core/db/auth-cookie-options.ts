// Shared Supabase auth cookie options so every client marks session cookies Secure outside local development.
import type { CookieOptionsWithName } from '@supabase/ssr';

export function supabaseAuthCookieOptions(): CookieOptionsWithName {
  return {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NEXT_PUBLIC_APP_ENV !== 'local',
  };
}
