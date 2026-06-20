import { PageHeader } from '@/components/layout/page-header';
import { requireProfile } from '@/features/auth/queries';
import {
  searchNotifications,
  type NotificationFilters,
} from '@/features/notifications/queries';
import { NotificationsView } from '@/components/notifications/notifications-view';
import type { NotificationType } from '@/types/domain';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TYPES: readonly NotificationType[] = [
  'plan_published',
  'draft_exists',
  'staffing_warning',
  'rotation_alert',
  'uph_warning',
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function parseType(value: string): NotificationFilters['type'] {
  return (TYPES as readonly string[]).includes(value)
    ? (value as NotificationType)
    : 'all';
}

function parseRead(value: string): NotificationFilters['read'] {
  return value === 'read' || value === 'unread' ? value : 'all';
}

const PAGE_SIZE = 15;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireProfile();
  const sp = await searchParams;

  const filters: NotificationFilters = {
    type: parseType(first(sp.type)),
    read: parseRead(first(sp.read)),
    search: first(sp.q),
    page: Math.max(1, Number(first(sp.page)) || 1),
    pageSize: PAGE_SIZE,
  };

  const result = await searchNotifications(filters);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Operational alerts for plans, staffing, rotation, and UPH."
      />
      <NotificationsView result={result} filters={filters} />
    </>
  );
}
