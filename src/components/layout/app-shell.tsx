'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserRole } from '@/lib/constants/roles';
import { ToastProvider } from '@/components/ui';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils/cn';

interface AppShellProps {
  user: { fullName: string; email: string; role: UserRole };
  children: ReactNode;
}

const COLLAPSE_KEY = 'shiftflow:sidebar-collapsed';

/**
 * Authenticated application chrome: role-aware sidebar + header with a
 * responsive mobile drawer (§5 Dashboard Layout, Responsive Standards).
 * Holds presentation state only: the mobile drawer and the desktop
 * collapsed-sidebar preference (persisted to localStorage).
 */
export function AppShell({ user, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the desktop collapse preference after mount (avoids a hydration
  // mismatch — the server can't read localStorage). Applied on the next frame
  // rather than synchronously in the effect body.
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'),
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <ToastProvider>
      <div className="bg-background min-h-screen">
        <Sidebar
          role={user.role}
          open={mobileNavOpen}
          collapsed={collapsed}
          onClose={() => setMobileNavOpen(false)}
        />
        <div
          className={cn(
            'flex min-h-screen flex-col transition-[padding] duration-200',
            collapsed ? 'lg:pl-16' : 'lg:pl-64',
          )}
        >
          <Header
            onMenuClick={() => setMobileNavOpen(true)}
            onToggleSidebar={toggleCollapsed}
            collapsed={collapsed}
            user={user}
          />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
