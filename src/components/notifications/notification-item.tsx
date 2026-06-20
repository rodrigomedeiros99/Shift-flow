'use client';

import { cn } from '@/lib/utils/cn';
import type { Notification } from '@/types/domain';
import { SEVERITY_DOT, relativeTime } from './notification-meta';

interface NotificationItemProps {
  notification: Notification;
  /** Invoked on click; the parent marks read + navigates to `link`. */
  onSelect: (notification: Notification) => void;
}

/**
 * A single notification row, shared by the bell dropdown and the View All page.
 * Unread rows carry a colored severity dot and a subtle background; read rows
 * show a muted dot only (per spec: read = no colored indicator).
 */
export function NotificationItem({
  notification,
  onSelect,
}: NotificationItemProps) {
  const unread = !notification.isRead;
  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
        'hover:bg-surface-raised cursor-pointer',
        unread && 'bg-surface-raised/50',
      )}
    >
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          unread ? SEVERITY_DOT[notification.severity] : 'bg-border',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'text-foreground block truncate text-sm',
            unread ? 'font-semibold' : 'font-medium',
          )}
        >
          {notification.title}
        </span>
        <span className="text-foreground-muted mt-0.5 block text-xs">
          {notification.message}
        </span>
        <span className="text-foreground-subtle mt-1 block text-[11px]">
          {relativeTime(notification.createdAt)}
        </span>
      </span>
      {unread ? <span className="sr-only">Unread</span> : null}
    </button>
  );
}
