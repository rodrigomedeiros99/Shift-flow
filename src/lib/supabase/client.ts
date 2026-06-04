import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';

/**
 * Supabase client for use in Client Components.
 * Uses only the public anon key; all privileged access is enforced by RLS
 * (§3 Security Standards). Auth wiring lands in Phase 2.
 */
export function createClient() {
  return createBrowserClient(
    clientEnv.supabaseUrl(),
    clientEnv.supabaseAnonKey(),
  );
}
