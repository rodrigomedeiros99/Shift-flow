/**
 * Theme-aware color classes for an equipment badge, keyed by equipment name
 * (case-insensitive). Clamp = green, Pacer = blue, Walk = purple, anything else
 * = neutral. Light/dark variants are baked in via `dark:` so the badge stays
 * readable in both themes without hardcoding a single text color.
 *
 * Shared so TV Mode, Live Plan, and Create Plan review can color equipment the
 * same way wherever a badge is rendered.
 */
export function getEquipmentBadgeClass(
  equipmentName: string | null | undefined,
): string {
  const n = (equipmentName ?? '').toLowerCase();
  // Light mode: same readable neutral body as the fallback badge (dark gray text
  // on light gray) — the color identity is carried only by the border, so the
  // text stays high-contrast. Dark mode keeps its tinted colors (unchanged).
  if (n.includes('clamp')) {
    return 'border-green-600 bg-gray-100 text-gray-900 dark:border-green-500/50 dark:bg-green-500/20 dark:text-green-200';
  }
  if (n.includes('pacer')) {
    return 'border-blue-600 bg-gray-100 text-gray-900 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-200';
  }
  if (n.includes('walk')) {
    return 'border-purple-600 bg-gray-100 text-gray-900 dark:border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-200';
  }
  return 'border-gray-400 bg-gray-100 text-gray-900 dark:border-border dark:bg-surface-raised dark:text-foreground-muted';
}
