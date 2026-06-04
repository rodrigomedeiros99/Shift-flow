/**
 * Small date helpers shared by client and server. Plans are keyed by calendar
 * date (`YYYY-MM-DD`), so we work with that string form rather than Date objects.
 */

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
