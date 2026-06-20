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
  /** Desktop collapsed state (icons only). Only affects `lg` and up. */
  collapsed: boolean;
  onClose: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A hover tooltip shown to the right of a collapsed nav icon (desktop only).
 * The mobile drawer always shows labels, so the tooltip is `lg`-gated.
 */
function CollapsedTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="bg-foreground text-background pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 scale-95 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition group-hover/nav:scale-100 group-hover/nav:opacity-100 lg:group-hover/nav:block"
    >
      {label}
    </span>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  if (!item.enabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          'group/nav text-foreground-subtle relative flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm',
          collapsed && 'lg:justify-center lg:px-2',
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
        </span>
        <span
          className={cn(
            'bg-surface-raised rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
            collapsed && 'lg:hidden',
          )}
        >
          Soon
        </span>
        {collapsed ? <CollapsedTooltip label={`${item.label} (soon)`} /> : null}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group/nav relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        collapsed && 'lg:justify-center lg:px-2',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
      {collapsed ? <CollapsedTooltip label={item.label} /> : null}
    </Link>
  );
}

export function Sidebar({ role, open, collapsed, onClose }: SidebarProps) {
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
          'border-border bg-surface fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-[transform,width] duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-16' : 'lg:w-64',
        )}
      >
        <div
          className={cn(
            'border-border flex h-16 items-center justify-between border-b px-4',
            collapsed && 'lg:justify-center lg:px-2',
          )}
        >
          <Brand collapsed={collapsed} />
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-1 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          className={cn(
            'flex-1 space-y-1 overflow-y-auto px-3 py-4',
            collapsed && 'lg:px-2',
          )}
        >
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
