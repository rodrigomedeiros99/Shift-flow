import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentProfile } from '@/features/auth/queries';

/**
 * Layout for the authenticated application surface (dashboard, settings, and
 * future planning routes). Middleware already blocks unauthenticated requests;
 * resolving the profile here enforces auth again (defense in depth) and feeds
 * role-aware chrome.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  return (
    <AppShell
      user={{
        fullName: profile.fullName,
        email: profile.email,
        role: profile.role,
      }}
    >
      {children}
    </AppShell>
  );
}
