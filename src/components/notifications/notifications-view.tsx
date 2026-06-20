'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Archive, Search } from 'lucide-react';
import { Button, Input, Select, useToast } from '@/components/ui';
import {
  clearReadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/actions';
import type {
  NotificationFilters,
  NotificationPage,
} from '@/features/notifications/queries';
import type { Notification, NotificationType } from '@/types/domain';
import { NotificationItem } from './notification-item';
import { TYPE_LABEL } from './notification-meta';

interface NotificationsViewProps {
  result: NotificationPage;
  filters: NotificationFilters;
}

const TYPE_OPTIONS: readonly NotificationType[] = [
  'plan_published',
  'draft_exists',
  'staffing_warning',
  'rotation_alert',
  'uph_warning',
];

/** View All notifications: search/filter, paginated feed, and header actions. */
export function NotificationsView({ result, filters }: NotificationsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(filters.search);
  const [pending, setPending] = useState(false);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function navigate(overrides: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    const type = overrides.type ?? filters.type;
    const read = overrides.read ?? filters.read;
    const q = overrides.q ?? filters.search;
    const page = overrides.page ?? '1';
    if (type !== 'all') params.set('type', type);
    if (read !== 'all') params.set('read', read);
    if (q.trim()) params.set('q', q.trim());
    if (page !== '1') params.set('page', page);
    const qs = params.toString();
    router.push(qs ? `/notifications?${qs}` : '/notifications');
  }

  async function handleSelect(n: Notification) {
    if (!n.isRead) await markNotificationRead(n.id);
    if (n.link) router.push(n.link);
    else router.refresh();
  }

  async function runAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (res.ok) {
      toast({ title: successMsg });
      router.refresh();
    } else {
      toast({
        title: 'Could not update',
        description: res.error,
        variant: 'error',
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters + header actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: search });
            }}
            className="flex items-end gap-2"
          >
            <label className="block">
              <span className="text-foreground-muted mb-1 block text-xs">
                Search
              </span>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title or message…"
                className="w-56"
              />
            </label>
            <Button type="submit" variant="secondary" size="sm">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </form>

          <label className="block">
            <span className="text-foreground-muted mb-1 block text-xs">
              Type
            </span>
            <Select
              value={filters.type}
              onChange={(e) => navigate({ type: e.target.value })}
              className="w-44"
            >
              <option value="all">All types</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="text-foreground-muted mb-1 block text-xs">
              Status
            </span>
            <Select
              value={filters.read}
              onChange={(e) => navigate({ read: e.target.value })}
              className="w-36"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </Select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              runAction(markAllNotificationsRead, 'All marked read')
            }
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => runAction(clearReadNotifications, 'Read cleared')}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            Clear read
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="border-border bg-surface overflow-hidden rounded-md border">
        {result.rows.length === 0 ? (
          <p className="text-foreground-muted px-3 py-12 text-center text-sm">
            No notifications match these filters.
          </p>
        ) : (
          <div className="border-border divide-y">
            {result.rows.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {result.total > result.pageSize ? (
        <div className="flex items-center justify-between">
          <p className="text-foreground-muted text-xs">
            Page {result.page} of {totalPages} · {result.total} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={result.page <= 1}
              onClick={() => navigate({ page: String(result.page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={result.page >= totalPages}
              onClick={() => navigate({ page: String(result.page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
