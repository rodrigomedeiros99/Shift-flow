/**
 * Plain CSS class for an equipment "role" badge, keyed by equipment name
 * (case-insensitive). Clamp = green, Pacer = blue, Walk = purple, anything else
 * = neutral.
 *
 * The actual colors live in `globals.css` (`.equip-badge-*` + `.dark` overrides,
 * mirroring docs/tv-v1-light.jsx). Using hand-written CSS classes — rather than
 * runtime Tailwind class names — guarantees the badge always renders readably in
 * both themes, with no dependency on Tailwind scanning/generating the utilities.
 */
export function getEquipmentBadgeClass(
  equipmentName: string | null | undefined,
): string {
  const n = (equipmentName ?? '').toLowerCase();
  if (n.includes('clamp')) return 'equip-badge-clamp';
  if (n.includes('pacer')) return 'equip-badge-pacer';
  if (n.includes('walk')) return 'equip-badge-walk';
  return 'equip-badge-neutral';
}
