/**
 * Application roles. These mirror `profiles.role` in the database (Schema Part 3)
 * and drive RBAC at the UI, server, and RLS layers (PRD §3).
 *
 * New roles (Operations Manager, Area Manager, …) are expected to be added via
 * role definitions without code changes per PRD §3, so consumers should treat
 * unknown roles defensively rather than assuming this list is exhaustive.
 */
export const USER_ROLES = [
  'admin',
  'supervisor',
  'inbound_leader',
  'outbound_leader',
  'viewer',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  inbound_leader: 'Inbound Leader',
  outbound_leader: 'Outbound Leader',
  viewer: 'Viewer',
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
