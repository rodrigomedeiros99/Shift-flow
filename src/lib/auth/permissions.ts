import type { UserRole } from '@/lib/constants/roles';

/**
 * Route-level access control (PRD §3).
 * Maps a route prefix to the roles allowed to access it. Enforced server-side
 * (layouts/pages) in addition to RLS — the UI hiding a link is never the only
 * gate (§3 Frontend Security Rule). Routes not listed here are treated as
 * authenticated-only.
 */
export const ROUTE_ACCESS: Record<string, readonly UserRole[]> = {
  '/dashboard': [
    'admin',
    'supervisor',
    'inbound_leader',
    'outbound_leader',
    'viewer',
  ],
  '/create-plan': ['admin', 'supervisor', 'inbound_leader', 'outbound_leader'],
  '/tv': ['admin', 'supervisor', 'inbound_leader', 'outbound_leader', 'viewer'],
  '/live-plan': ['admin', 'supervisor', 'inbound_leader', 'outbound_leader'],
  '/history': ['admin', 'supervisor', 'inbound_leader', 'outbound_leader'],
  '/notifications': [
    'admin',
    'supervisor',
    'inbound_leader',
    'outbound_leader',
    'viewer',
  ],
  '/associates': ['admin', 'supervisor'],
  '/tasks': ['admin', 'supervisor'],
  '/equipment': ['admin', 'supervisor'],
  '/dock-doors': ['admin', 'supervisor'],
  '/templates': ['admin', 'supervisor', 'inbound_leader', 'outbound_leader'],
  '/settings': ['admin', 'supervisor'],
};

/** Longest-prefix match so nested routes inherit their section's access. */
function matchRoute(pathname: string): readonly UserRole[] | undefined {
  let best: { length: number; roles: readonly UserRole[] } | undefined;
  for (const [route, roles] of Object.entries(ROUTE_ACCESS)) {
    if (
      (pathname === route || pathname.startsWith(`${route}/`)) &&
      route.length > (best?.length ?? -1)
    ) {
      best = { length: route.length, roles };
    }
  }
  return best?.roles;
}

/** Whether a role may access a route. Unlisted routes require only auth. */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const roles = matchRoute(pathname);
  return roles ? roles.includes(role) : true;
}
