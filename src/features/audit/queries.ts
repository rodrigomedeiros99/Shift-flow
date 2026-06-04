import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuditLog } from '@/types/domain';

/**
 * Read access for the audit trail (Phase 10). RLS already restricts SELECT to
 * managers (admin/supervisor) in the facility, so this returns nothing for
 * other roles even if the route were reached.
 */

interface AuditRow {
  id: string;
  facility_id: string;
  user_id: string | null;
  daily_plan_id: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

/** id → full name for users in the facility (managers may read these via RLS). */
export async function listFacilityProfileNames(): Promise<
  { id: string; fullName: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name');
  if (error) throw new Error(`Failed to load profiles: ${error.message}`);
  return ((data as { id: string; full_name: string }[] | null) ?? []).map(
    (r) => ({ id: r.id, fullName: r.full_name }),
  );
}

export async function listRecentAudit(limit = 100): Promise<AuditLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select(
      'id, facility_id, user_id, daily_plan_id, action_type, entity_type, entity_id, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load audit log: ${error.message}`);
  return ((data as AuditRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    userId: r.user_id,
    dailyPlanId: r.daily_plan_id,
    actionType: r.action_type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    createdAt: r.created_at,
  }));
}
