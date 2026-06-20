import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CalendarPlus,
  Activity,
  History,
  Users,
  ClipboardList,
  Forklift,
  DoorClosed,
  MonitorPlay,
  Settings,
} from 'lucide-react';
import type { UserRole } from '@/lib/constants/roles';
import { ROUTE_ACCESS } from '@/lib/auth/permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Whether the destination route exists yet. The full information
   * architecture (§5 Dashboard Layout) is shown from Phase 1 so the navigation
   * never changes shape, but routes are enabled as their phase ships. Disabled
   * items render as non-interactive with a "Soon" marker instead of dead links.
   */
  enabled: boolean;
  /** Roles permitted to see/visit this item (mirrors {@link ROUTE_ACCESS}). */
  allowedRoles: readonly UserRole[];
}

/**
 * Primary sidebar navigation (§5 Dashboard Layout → Sidebar).
 * Phase 2 enables Dashboard and Settings; remaining items unlock in later
 * phases. Visibility is filtered by role using {@link ROUTE_ACCESS} so the menu
 * only shows what a user may actually access.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    label: 'Create Plan',
    href: '/create-plan',
    icon: CalendarPlus,
    enabled: true,
  },
  { label: 'Live Plan', href: '/live-plan', icon: Activity, enabled: true },
  { label: 'TV Mode', href: '/tv', icon: MonitorPlay, enabled: true },
  { label: 'History', href: '/history', icon: History, enabled: true },
  { label: 'Associates', href: '/associates', icon: Users, enabled: true },
  { label: 'Tasks', href: '/tasks', icon: ClipboardList, enabled: true },
  { label: 'Equipment', href: '/equipment', icon: Forklift, enabled: true },
  {
    label: 'Dock Doors',
    href: '/dock-doors',
    icon: DoorClosed,
    enabled: true,
  },
  { label: 'Settings', href: '/settings', icon: Settings, enabled: true },
].map((item) => ({
  ...item,
  allowedRoles: ROUTE_ACCESS[item.href] ?? [],
}));

/** Nav items visible to the given role. */
export function navForRole(role: UserRole): NavItem[] {
  return PRIMARY_NAV.filter((item) => item.allowedRoles.includes(role));
}
