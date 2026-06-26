import type { Associate } from '@/types/domain';

/** Display name, first-name first (the form every picker shows). */
export function associateFullName(
  a: Pick<Associate, 'firstName' | 'lastName'>,
): string {
  return `${a.firstName} ${a.lastName}`;
}

/**
 * Case-insensitive A–Z comparator on the full name (first-name first), with a
 * stable `id` tie-break so equal names keep a deterministic order. Used by every
 * associate picker in Create Plan and Live Plan so the lists always read
 * alphabetically (e.g. Alex Brown · Brandon Smith · Carlos Lopez).
 */
export function compareAssociates(a: Associate, b: Associate): number {
  const byName = associateFullName(a).localeCompare(
    associateFullName(b),
    undefined,
    { sensitivity: 'base' },
  );
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

/** A new array sorted A–Z by full name; never mutates the input. */
export function sortAssociates(list: Associate[]): Associate[] {
  return [...list].sort(compareAssociates);
}
