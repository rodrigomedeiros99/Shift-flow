import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/queries';

/**
 * Load Priority TV shell — like the Labor TV Mode shell, deliberately outside the
 * dashboard AppShell: no sidebar/header, full-bleed for a warehouse display. Auth
 * is enforced here (defense in depth alongside the proxy); any authenticated
 * role, including viewer, may watch the board.
 */
export default async function LoadPriorityTvLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  return <div className="bg-background min-h-screen">{children}</div>;
}
