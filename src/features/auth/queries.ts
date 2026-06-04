import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isUserRole, type UserRole } from '@/lib/constants/roles';
import type { Profile } from '@/types/domain';

/** Shape of the columns we select from `profiles` (snake_case from Postgres). */
interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  facility_id: string | null;
  department_id: string | null;
  active: boolean;
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  // Fall back to the least-privileged role if the DB ever holds an unknown
  // value, so an unexpected role can never be treated as elevated access.
  const role: UserRole = isUserRole(row.role) ? row.role : 'viewer';
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role,
    facilityId: row.facility_id ?? '',
    departmentId: row.department_id,
    active: row.active,
    createdAt: row.created_at,
  };
}

/**
 * The authenticated user, validated against Supabase Auth (not just a decoded
 * cookie). `cache` dedupes calls within a single request.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The current user's application profile (role, facility, …), or null. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, role, facility_id, department_id, active, created_at',
    )
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return toProfile(data as ProfileRow);
});

/**
 * Resolve the current profile or redirect. `requireProfile` enforces
 * authentication; `requireRole` additionally enforces route authorization
 * server-side (§3 defense in depth). Use these at the top of protected pages.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }
  return profile;
}

export async function requireRole(
  allowed: readonly UserRole[],
): Promise<Profile> {
  const profile = await requireProfile();
  if (!allowed.includes(profile.role)) {
    redirect('/dashboard');
  }
  return profile;
}

/** Roles allowed to manage operational configuration (Phase 3). */
export const CONFIG_MANAGER_ROLES = ['admin', 'supervisor'] as const;

/**
 * Roles allowed to manage planning templates (Phase 4). Broader than config:
 * the planning leaders build templates, not just admins/supervisors. Mirrors
 * `ROUTE_ACCESS['/templates']` and the `auth_can_plan()` RLS helper.
 */
export const TEMPLATE_MANAGER_ROLES = [
  'admin',
  'supervisor',
  'inbound_leader',
  'outbound_leader',
] as const;

/**
 * Roles allowed to create and publish daily plans (Phase 5+). Same set of
 * planning leaders as templates; named for planning intent. Mirrors
 * `ROUTE_ACCESS['/create-plan']` and the `auth_can_plan()` RLS helper.
 */
export const PLANNER_ROLES = [
  'admin',
  'supervisor',
  'inbound_leader',
  'outbound_leader',
] as const;
