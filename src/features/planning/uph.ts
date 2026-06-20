/**
 * UPH (Units Per Hour) labor math — pure and IO-free. Recommends headcount from
 * units, the task's UPH, and the shift's productive hours:
 *
 *   people = CEIL(units / (uph × shiftHours))
 *
 * Returns null when a recommendation can't be made (no units, or UPH / shift
 * hours not configured) — the calculator then shows "Not configured" and the
 * supervisor enters staffing manually. UPH never forces the final number.
 */
export function recommendedPeople(
  units: number,
  uph: number | null | undefined,
  shiftHours: number | null | undefined,
): number | null {
  if (!Number.isFinite(units) || units <= 0) return null;
  if (!uph || uph <= 0) return null;
  if (!shiftHours || shiftHours <= 0) return null;
  return Math.ceil(units / (uph * shiftHours));
}
