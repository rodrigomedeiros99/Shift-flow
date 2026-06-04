import 'server-only';

import { requiredEnv } from './env';

/**
 * Server-only environment access. The `server-only` import makes this module a
 * build-time error if it is ever imported into a Client Component, so the
 * service-role key can never be bundled to the browser (Engineering Standards
 * §3). Nothing in the app needs admin privileges yet — RLS + the anon key cover
 * all runtime access — so this exists as the single, guarded home for the
 * service-role secret if a future server-only admin task needs it.
 */
export const serverEnv = {
  supabaseServiceRoleKey: (): string =>
    requiredEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
};
