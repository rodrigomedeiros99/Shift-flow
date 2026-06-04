/**
 * Department classification (`departments.kind`, migration 0006).
 *
 * The `kind` drives which planning workflow a department uses — inbound is
 * dock-door driven, outbound is task driven — so the app never has to infer the
 * flow from a department's name (no hardcoded names; project rule).
 */

export const DEPARTMENT_KINDS = [
  'inbound',
  'outbound',
  'support',
  'other',
] as const;

export type DepartmentKind = (typeof DEPARTMENT_KINDS)[number];

export const DEPARTMENT_KIND_LABELS: Record<DepartmentKind, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  support: 'Support',
  other: 'Other',
};
