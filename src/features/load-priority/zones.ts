import type { LoadPriorityZone } from '@/types/domain';

/**
 * Weekday helpers + configurable zone assignment. Pure and client-safe. Weekday
 * numbering follows JS `Date.getDay()` (0 = Sunday … 6 = Saturday).
 */

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Weekdays in display order (Monday → Sunday). */
export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? '—';
}

/** The weekday (0–6) of a `YYYY-MM-DD` date, computed in UTC to avoid TZ drift. */
export function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/** Numeric part of a door number ("DD735" → 735), or null. */
export function doorNumeric(door: string): number | null {
  const m = door.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Zone for a door from the configured ranges, or null when none match. */
export function deriveZone(
  door: string,
  zones: LoadPriorityZone[],
): number | null {
  const n = doorNumeric(door);
  if (n === null) return null;
  const match = zones
    .filter((z) => z.active)
    .find((z) => n >= z.doorLow && n <= z.doorHigh);
  return match?.zone ?? null;
}
