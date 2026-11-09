// Create the service-role client exclusively inside the privileged boundary.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnvironment } from '../config/server-env';
import type { Database } from '../db/database.types';

export const privilegedClient = createClient<Database>(
  serverEnvironment.public.NEXT_PUBLIC_SUPABASE_URL,
  serverEnvironment.server.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);
