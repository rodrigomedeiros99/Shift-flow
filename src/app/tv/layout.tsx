import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/queries';

/**
 * TV Mode shell (Phase 8): deliberately outside the dashboard AppShell — no
 * sidebar or header, just a full-bleed dark surface optimized for warehouse
 * displays. Auth is enforced here (defense in depth alongside the proxy); any
 * authenticated role, including viewer, may watch the TV.
 */
export default async function TvLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  return <div className="bg-background min-h-screen">{children}</div>;
}
