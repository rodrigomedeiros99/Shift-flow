import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/layout/brand';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent } from '@/components/ui';
import { getAuthUser } from '@/features/auth/queries';

export const metadata: Metadata = {
  title: 'Sign in',
};

function resolveRedirect(value: string | string[] | undefined): string {
  const target = Array.isArray(value) ? value[0] : value;
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    return target;
  }
  return '/dashboard';
}

/**
 * Login screen. Already-authenticated users are sent straight to the dashboard;
 * middleware enforces the same rule, this is defense in depth.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}) {
  const user = await getAuthUser();
  if (user) {
    redirect('/dashboard');
  }

  const { redirectTo } = await searchParams;

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>

        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="text-foreground text-lg font-semibold">
                Sign in to your account
              </h1>
              <p className="text-foreground-muted text-sm">
                Access labor planning for DFC 5523.
              </p>
            </div>

            <LoginForm redirectTo={resolveRedirect(redirectTo)} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
