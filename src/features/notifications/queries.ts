import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  Notification,
  NotificationSeverity,
  NotificationType,
} from '@/types/domain';

/**
 * Notification reads. RLS already scopes every query to the current user's
 * facility and to rows addressed to them (or facility broadcasts), so these
 * never filter by user explicitly — the database is the gate.
 */

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

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'plan_published',
  'draft_exists',
  'staffing_warning',
  'rotation_alert',
  'uph_warning',
];
const SEVERITIES: readonly NotificationSeverity[] = [
  'info',
  'warning',
  'critical',
];

function toNotification(row: NotificationRow): Notification {
  const type = (NOTIFICATION_TYPES as readonly string[]).includes(row.type)
    ? (row.type as NotificationType)
    : 'plan_published';
  const severity = (SEVERITIES as readonly string[]).includes(row.severity)
    ? (row.severity as NotificationSeverity)
    : 'info';
  return {
    id: row.id,
    facilityId: row.facility_id,
    userId: row.user_id,
    type,
    severity,
    title: row.title,
    message: row.message,
    link: row.link,
    dailyPlanId: row.daily_plan_id,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

const COLUMNS =
  'id, facility_id, user_id, type, severity, title, message, link, daily_plan_id, is_read, read_at, created_at';

/** Most recent notifications for the bell dropdown (newest first). */
export async function listNotifications(limit = 7): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data as NotificationRow[] | null) ?? []).map(toNotification);
}

/** Count of unread notifications for the bell badge. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('is_read', false);
  if (error) return 0;
  return count ?? 0;
}

export interface NotificationFilters {
  type: NotificationType | 'all';
  read: 'all' | 'read' | 'unread';
  search: string;
  page: number;
  pageSize: number;
}

export interface NotificationPage {
  rows: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

/** Paginated, filtered feed for the View All page (newest first). */
export async function searchNotifications(
  filters: NotificationFilters,
): Promise<NotificationPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('notifications')
    .select(COLUMNS, { count: 'exact' })
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.read === 'read') query = query.eq('is_read', true);
  if (filters.read === 'unread') query = query.eq('is_read', false);
  const term = filters.search.trim();
  if (term) {
    const safe = term.replace(/[%,]/g, ' ');
    query = query.or(`title.ilike.%${safe}%,message.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) return { rows: [], total: 0, page, pageSize };
  return {
    rows: ((data as NotificationRow[] | null) ?? []).map(toNotification),
    total: count ?? 0,
    page,
    pageSize,
  };
}
