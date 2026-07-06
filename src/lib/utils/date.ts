/**
 * Small date helpers shared by client and server. Plans are keyed by calendar
 * date (`YYYY-MM-DD`), so we work with that string form rather than Date objects.
 */

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Format a `YYYY-MM-DD` (or ISO timestamp) as US `MM/DD/YYYY` for display.
 * Parses the date parts directly so it never shifts across time zones.
 */
export function formatDateUS(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

/**
 * Facility display time zone (DFC 5523 = US Eastern). Timestamps are stored in
 * UTC, so activity times are always formatted against this zone — otherwise a
 * server rendering in UTC would show e.g. 4:30 PM for a 12:30 PM Eastern change.
 */
export const FACILITY_TIME_ZONE = 'America/New_York';

/** Format an ISO timestamp as a 12-hour local time, e.g. `12:30 PM` (Eastern). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: FACILITY_TIME_ZONE,
      });
}

/** Format an ISO timestamp as US date + time, e.g. `06/07/2026, 2:30 PM` (Eastern). */
export function formatDateTimeUS(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: FACILITY_TIME_ZONE,
      });
}

/**
 * Add (or subtract) whole days to a `YYYY-MM-DD` date, returning the same form.
 * Uses UTC so it never drifts across DST boundaries.
 */
export function addDaysISO(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
