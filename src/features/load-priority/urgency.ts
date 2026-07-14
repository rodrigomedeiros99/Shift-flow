import type { LoadPriorityEntry } from '@/types/domain';

/**
 * Close-time urgency for a door entry. Thresholds are minutes-to-close; tweak
 * here (not in the UI). Pure + client-safe so the TV and management board share
 * the same logic.
 */
export type UrgencyLevel = 'critical' | 'soon' | 'later' | 'closed';

const CRITICAL_WITHIN_MIN = 30; // overdue or ≤ 30 min → red
const SOON_WITHIN_MIN = 90; // ≤ 90 min → orange

/** Minutes until an `HH:MM` close time today (negative = overdue). */
export function minutesToClose(
  closeTime: string | null,
  now: Date,
): number | null {
  if (!closeTime) return null;
  const parts = closeTime.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const close = new Date(now);
  close.setHours(h, m, 0, 0);
  return Math.round((close.getTime() - now.getTime()) / 60000);
}

export function entryUrgency(
  entry: Pick<LoadPriorityEntry, 'status' | 'closeTime'>,
  now: Date,
): UrgencyLevel {
  if (entry.status === 'closed') return 'closed';
  const mins = minutesToClose(entry.closeTime, now);
  if (mins === null) return 'later';
  if (mins <= CRITICAL_WITHIN_MIN) return 'critical';
  if (mins <= SOON_WITHIN_MIN) return 'soon';
  return 'later';
}

/** Left-border accent class (defined in globals.css) for an urgency level. */
export const URGENCY_BORDER: Record<UrgencyLevel, string> = {
  critical: 'lp-lvl-critical',
  soon: 'lp-lvl-soon',
  later: 'lp-lvl-later',
  closed: 'lp-lvl-closed',
};

/** Semantic text-color token for the close time / accent per level. */
export const URGENCY_TEXT: Record<UrgencyLevel, string> = {
  critical: 'text-danger',
  soon: 'text-warning',
  later: 'text-info',
  closed: 'text-success',
};

/** `17:00` → `5:00 PM`. */
export function formatCloseTime(closeTime: string | null): string {
  if (!closeTime) return '—';
  const parts = closeTime.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return closeTime;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Display label: door number plus its carrier override (wins) or lane number.
 * e.g. `DD735 (5084)`, `DD748 (UPS)`, or just `DD755`.
 */
export function doorLabel(
  entry: Pick<
    LoadPriorityEntry,
    'doorNumber' | 'carrierLabelSnapshot' | 'laneNumberSnapshot'
  >,
): string {
  const tag = entry.carrierLabelSnapshot ?? entry.laneNumberSnapshot;
  return tag ? `${entry.doorNumber} (${tag})` : entry.doorNumber;
}

/**
 * Sort within a zone: open doors first (by close time asc, null last), then
 * closed doors (by close time asc). Stable on door number.
 */
export function compareEntries(
  a: LoadPriorityEntry,
  b: LoadPriorityEntry,
): number {
  if (a.status !== b.status) return a.status === 'closed' ? 1 : -1;
  const at = a.closeTime ?? '99:99';
  const bt = b.closeTime ?? '99:99';
  return at.localeCompare(bt) || a.doorNumber.localeCompare(b.doorNumber);
}
