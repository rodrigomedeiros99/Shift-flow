'use client';

import { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { signOut } from '@/features/auth/actions';
import { USER_ROLE_LABELS, type UserRole } from '@/lib/constants/roles';
import { cn } from '@/lib/utils/cn';

interface UserMenuProps {
  fullName: string;
  email: string;
  role: UserRole;
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Account control: shows the signed-in user and a sign-out action (§5 Header). */
export function UserMenu({ fullName, email, role }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const displayName = fullName.trim() || email;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-surface-raised flex items-center gap-2 rounded-md p-1.5 text-sm"
      >
        <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
          {initials(fullName, email)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="text-foreground block max-w-[12rem] truncate font-medium">
            {displayName}
          </span>
          <span className="text-foreground-muted block text-xs">
            {USER_ROLE_LABELS[role]}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-foreground-subtle h-4 w-4 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="border-border bg-surface absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border shadow-lg"
          >
            <div className="border-border border-b px-3 py-2.5">
              <p className="text-foreground truncate text-sm font-medium">
                {displayName}
              </p>
              <p className="text-foreground-muted truncate text-xs">{email}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="text-foreground-muted hover:bg-surface-raised hover:text-foreground flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
