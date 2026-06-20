import type { NotificationSeverity, NotificationType } from '@/types/domain';

/**
 * Presentation metadata for notifications, shared by the bell dropdown and the
 * View All page. Severity colors map to a small status dot; the same tokens read
 * correctly in light, dark, and system themes.
 */

export const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

export const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export const TYPE_LABEL: Record<NotificationType, string> = {
  plan_published: 'Plan published',
  draft_exists: 'Draft exists',
  staffing_warning: 'Staffing warning',
  rotation_alert: 'Rotation alert',
  uph_warning: 'UPH warning',
};

/** Compact relative time (e.g. "Just now", "2h ago", "3d ago"). */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  return `${wk}w ago`;
}
