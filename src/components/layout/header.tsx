'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { DEFAULT_FACILITY_CODE } from '@/lib/constants/app';
import type { UserRole } from '@/lib/constants/roles';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { UserMenu } from './user-menu';

interface HeaderProps {
  onMenuClick: () => void;
  /** Toggle the desktop sidebar between expanded and icons-only. */
  onToggleSidebar: () => void;
  collapsed: boolean;
  user: { fullName: string; email: string; role: UserRole };
}

/**
 * Top header (§5 Header): facility context, notifications, and the account
 * menu. Department/key context is added once plan selection ships (Phases 5–6).
 */
export function Header({
  onMenuClick,
  onToggleSidebar,
  collapsed,
  user,
}: HeaderProps) {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onToggleSidebar}
        className="text-foreground-muted hover:bg-surface-raised hover:text-foreground hidden cursor-pointer rounded-md p-2 transition-colors lg:inline-flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-pressed={collapsed}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <div className="flex items-center gap-2">
        <span className="border-border bg-surface text-foreground-muted rounded-md border px-2.5 py-1 text-xs font-semibold">
          {DEFAULT_FACILITY_CODE}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell />

        <UserMenu
          fullName={user.fullName}
          email={user.email}
          role={user.role}
        />
      </div>
    </header>
  );
}
