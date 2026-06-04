'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from './schema';

export interface AuthFormState {
  error: string | null;
}

/** Only allow same-origin relative redirects to avoid open-redirect abuse. */
function safeRedirect(target: FormDataEntryValue | null): string {
  if (
    typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//')
  ) {
    return target;
  }
  return '/dashboard';
}

/**
 * Authenticate with Supabase Auth (email + password). Input is validated
 * server-side regardless of any client validation (§3: never trust the client).
 * Returns a generic error message — auth failures are not disambiguated to
 * avoid leaking which accounts exist.
 */
export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Enter a valid email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: 'Invalid email or password.' };
  }

  redirect(safeRedirect(formData.get('redirectTo')));
}

/** End the session and return to the login screen. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
