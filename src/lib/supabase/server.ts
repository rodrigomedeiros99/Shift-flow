import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the auth session via Next.js cookies so RLS receives the
 * authenticated user. Privileged operations are validated server-side (§3).
 *
 * Session refresh from middleware is added in Phase 2; the `setAll` guard below
 * tolerates being called from a Server Component (where cookies are read-only).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.supabaseUrl(),
    clientEnv.supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render — cookies are read-only here.
            // Middleware (Phase 2) is responsible for persisting refreshed sessions.
          }
        },
      },
    },
  );
}
