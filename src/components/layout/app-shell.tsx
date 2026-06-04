'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { UserRole } from '@/lib/constants/roles';
import { ToastProvider } from '@/components/ui';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppShellProps {
  user: { fullName: string; email: string; role: UserRole };
  children: ReactNode;
}

/**
 * Authenticated application chrome: role-aware sidebar + header with a
 * responsive mobile drawer (§5 Dashboard Layout, Responsive Standards).
 * Holds only presentation state (drawer open/closed); auth and the user's
 * profile are resolved server-side and passed in.
 */
export function AppShell({ user, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="bg-background min-h-screen">
        <Sidebar
          role={user.role}
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-h-screen flex-col lg:pl-64">
          <Header onMenuClick={() => setMobileNavOpen(true)} user={user} />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
