'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navForRole, type NavItem } from '@/lib/constants/navigation';
import type { UserRole } from '@/lib/constants/roles';
import { Brand } from './brand';
import { cn } from '@/lib/utils/cn';

interface SidebarProps {
  /** Current user's role — determines which nav items are visible. */
  role: UserRole;
  /** Mobile drawer open state. Ignored at `lg` and up, where the sidebar is static. */
  open: boolean;
  onClose: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <span
        aria-disabled="true"
        className="text-foreground-subtle flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm"
      >
        <span className="flex items-center gap-3">
          <Icon className="h-5 w-5" aria-hidden="true" />
          {item.label}
        </span>
        <span className="bg-surface-raised rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      ) : null}

      <aside
        aria-label="Primary"
        className={cn(
          'border-border bg-surface fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-border flex h-16 items-center justify-between border-b px-4">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-1 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
