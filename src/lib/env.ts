/**
 * Centralized, validated PUBLIC environment access (NEXT_PUBLIC_*).
 * Ref: Engineering Standards §1/§3 (environment variables, never expose secrets).
 *
 * Access is lazy (getter functions) so importing this module never throws at
 * build time; a missing variable fails loudly only when a client is actually
 * constructed, with a clear message.
 *
 * Server-only secrets (the service-role key) live in `./env-server`, which is
 * marked `server-only` so it cannot be imported into a Client Component.
 */

export function requiredEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy .env.example to .env.local and provide a value.',
    );
  }
  return value;
}

/** Safe to reference from the browser (NEXT_PUBLIC_*). */
export const clientEnv = {
  supabaseUrl: (): string =>
    requiredEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
  supabaseAnonKey: (): string =>
    requiredEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
};
