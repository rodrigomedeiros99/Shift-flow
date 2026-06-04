'use client';

import { useActionState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { signIn, type AuthFormState } from '@/features/auth/actions';
import { Button, Input, Label } from '@/components/ui';

const initialState: AuthFormState = { error: null };

/**
 * Login form. Submits to the `signIn` server action (which re-validates and
 * authenticates server-side); `useActionState` surfaces a generic error and
 * pending state. Native `required`/`type=email` give immediate client feedback.
 */
export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state.error ? (
        <div
          role="alert"
          className="bg-danger/15 text-danger flex items-center gap-2 rounded-md px-3 py-2 text-sm"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@homedepot.com"
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={pending}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
