'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/features/notifications/actions';
import type {
  Notification,
  NotificationSeverity,
  NotificationType,
} from '@/types/domain';
import { cn } from '@/lib/utils/cn';
import { NotificationItem } from './notification-item';

const PANEL_LIMIT = 7;

interface NotificationRow {
  id: string;
  facility_id: string;
  user_id: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
  daily_plan_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

function mapRow(r: NotificationRow): Notification {
  return {
    id: r.id,
    facilityId: r.facility_id,
    userId: r.user_id,
    type: r.type as NotificationType,
    severity: r.severity as NotificationSeverity,
    title: r.title,
    message: r.message,
    link: r.link,
    dailyPlanId: r.daily_plan_id,
    isRead: r.is_read,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

const COLUMNS =
  'id, facility_id, user_id, type, severity, title, message, link, daily_plan_id, is_read, read_at, created_at';

/**
 * Header notification center. Reads the current user's notifications directly
 * via the RLS-scoped browser client and live-updates through Supabase Realtime,
 * so the unread badge stays current without a full page reload. The dropdown
 * follows the existing user-menu overlay pattern.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [recent, count] = await Promise.all([
      supabase
        .from('notifications')
        .select(COLUMNS)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(PANEL_LIMIT),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .eq('is_read', false),
    ]);
    setItems(((recent.data as NotificationRow[] | null) ?? []).map(mapRow));
    setUnread(count.count ?? 0);
  }, []);

  useEffect(() => {
    // Initial load on the next frame (avoids a synchronous setState in the
    // effect body) plus live updates via Realtime, debounced.
    const raf = requestAnimationFrame(() => void load());
    const supabase = createClient();
    const channel = supabase
      .channel('rt-notifications-bell')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => void load(), 300);
        },
      )
      .subscribe();
    return () => {
      cancelAnimationFrame(raf);
      if (debounce.current) clearTimeout(debounce.current);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function handleSelect(n: Notification) {
    setOpen(false);
    if (!n.isRead) {
      await markNotificationRead(n.id);
      void load();
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    void load();
  }

  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }
        className="text-foreground-muted hover:bg-surface-raised hover:text-foreground relative cursor-pointer rounded-md p-2 transition-colors"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 ? (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {badge}
          </span>
        ) : null}
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
            className="border-border bg-surface absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border shadow-lg sm:w-96"
          >
            <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
              <p className="text-foreground text-sm font-semibold">
                Notifications
              </p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-foreground-muted hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <p className="text-foreground-muted px-3 py-8 text-center text-sm">
                You&apos;re all caught up.
              </p>
            ) : (
              <div className="border-border max-h-96 divide-y overflow-y-auto">
                {items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}

            <div className="border-border border-t">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className={cn(
                  'text-primary hover:bg-surface-raised block px-3 py-2.5 text-center text-sm font-medium transition-colors',
                )}
              >
                View all
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
