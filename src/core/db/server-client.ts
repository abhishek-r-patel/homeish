// Create a request-scoped Supabase client that always uses the signed-in user.
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnvironment } from '../config/server-env';
import type { Database } from './database.types';

export const ACTIVE_SOCIETY_COOKIE = 'homeish-active-society';

export async function createUserSupabaseClient() {
  const cookieStore = await cookies();
  const client = createServerClient<Database>(
    serverEnvironment.public.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.public.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
  return {
    client,
    activeSocietyId: cookieStore.get(ACTIVE_SOCIETY_COOKIE)?.value ?? null,
  };
}
