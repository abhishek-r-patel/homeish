// Reuse the cookie-backed Supabase client in notification browser components.
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

let client: SupabaseClient<Database> | undefined;

export function createNotificationBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public environment is not configured.');
  }
  client ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}
