import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { listTodayPlans } from '@/features/planning/queries';
import type { ActivityHistory, DailyPlan } from '@/types/domain';
import type { ActivityAction } from '@/lib/constants/assignments';

/**
 * Read access for Live Operations (Steps 9–10). RLS scopes every result to the
 * caller's facility. Plan/assignment/special/door/call-off reads are reused
 * from the planning feature; this module adds the live-only queries.
 */

async function db() {
  return createClient();
}

function fail(entity: string, message: string): never {
  throw new Error(`Failed to load ${entity}: ${message}`);
}

/** Today's published plans — the ones a leader can run live. */
export async function listPublishedTodayPlans(): Promise<DailyPlan[]> {
  const plans = await listTodayPlans();
  return plans.filter((p) => p.status === 'published');
}

interface ActivityRow {
  id: string;
  daily_plan_id: string;
  associate_id: string;
  from_task_type_id: string | null;
  to_task_type_id: string | null;
  from_equipment_id: string | null;
  to_equipment_id: string | null;
  from_dock_door_id: string | null;
  to_dock_door_id: string | null;
  action_type: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

const ACTIVITY_COLUMNS =
  'id, daily_plan_id, associate_id, from_task_type_id, to_task_type_id, from_equipment_id, to_equipment_id, from_dock_door_id, to_dock_door_id, action_type, reason, changed_by, changed_at';

/** Recent activity for a plan, newest first (for the live timeline panel). */
export async function listActivity(
  planId: string,
  limit = 50,
): Promise<ActivityHistory[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('activity_history')
    .select(ACTIVITY_COLUMNS)
    .eq('daily_plan_id', planId)
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) fail('activity', error.message);
  return ((data as ActivityRow[] | null) ?? []).map((r) => ({
    id: r.id,
    dailyPlanId: r.daily_plan_id,
    associateId: r.associate_id,
    fromTaskTypeId: r.from_task_type_id,
    toTaskTypeId: r.to_task_type_id,
    fromEquipmentId: r.from_equipment_id,
    toEquipmentId: r.to_equipment_id,
    fromDockDoorId: r.from_dock_door_id,
    toDockDoorId: r.to_dock_door_id,
    actionType: r.action_type as ActivityAction,
    reason: r.reason,
    changedBy: r.changed_by,
    changedAt: r.changed_at,
  }));
}
