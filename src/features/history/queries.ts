import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  listAssociates,
  listDepartments,
  listDockDoors,
  listEquipment,
  listShiftKeys,
  listTasks,
} from '@/features/config/queries';
import type { DateRange } from './range';
import type {
  ActivityHistory,
  Associate,
  Department,
  DockDoor,
  EquipmentType,
  ShiftKey,
  TaskType,
} from '@/types/domain';
import type {
  ActivityAction,
  SpecialAssignmentType,
} from '@/lib/constants/assignments';

/**
 * Read access for History & Reporting (Phase 9). Read-only; RLS scopes every
 * result to the caller's facility. Planned history and activity history are
 * queried separately and never merged (PRD §4.1).
 */

async function db() {
  return createClient();
}

function fail(entity: string, message: string): never {
  throw new Error(`Failed to load ${entity}: ${message}`);
}

export interface HistoryFilter {
  departmentId: string;
  shiftKeyId: string;
  associateId: string;
  taskTypeId: string;
  equipmentId: string;
  range: DateRange;
}

export interface HistoryFilterOptions {
  departments: Department[];
  shiftKeys: ShiftKey[];
  associates: Associate[];
  tasks: TaskType[];
  equipment: EquipmentType[];
  dockDoors: DockDoor[];
}

export async function getHistoryFilterOptions(): Promise<HistoryFilterOptions> {
  const [departments, shiftKeys, associates, tasks, equipment, dockDoors] =
    await Promise.all([
      listDepartments(),
      listShiftKeys(),
      listAssociates(),
      listTasks(),
      listEquipment(),
      listDockDoors(),
    ]);
  return { departments, shiftKeys, associates, tasks, equipment, dockDoors };
}

// --- Planned Assignment History ---------------------------------------------

export interface PlannedRow {
  id: string;
  planDate: string;
  associateId: string;
  taskTypeId: string | null;
  equipmentId: string | null;
  dockDoorId: string | null;
}

interface PlannedHistoryRow {
  id: string;
  plan_date: string;
  associate_id: string;
  task_type_id: string | null;
  equipment_id: string | null;
  dock_door_id: string | null;
}

export async function getPlannedHistory(
  filter: HistoryFilter,
): Promise<PlannedRow[]> {
  const supabase = await db();
  let query = supabase
    .from('planned_assignment_history')
    .select(
      'id, plan_date, associate_id, task_type_id, equipment_id, dock_door_id',
    )
    .gte('plan_date', filter.range.from)
    .lte('plan_date', filter.range.to)
    .order('plan_date', { ascending: false })
    .limit(2000);

  if (filter.departmentId)
    query = query.eq('department_id', filter.departmentId);
  if (filter.shiftKeyId) query = query.eq('shift_key_id', filter.shiftKeyId);
  if (filter.associateId) query = query.eq('associate_id', filter.associateId);
  if (filter.taskTypeId) query = query.eq('task_type_id', filter.taskTypeId);
  if (filter.equipmentId) query = query.eq('equipment_id', filter.equipmentId);

  const { data, error } = await query;
  if (error) fail('planned history', error.message);
  return ((data as PlannedHistoryRow[] | null) ?? []).map((r) => ({
    id: r.id,
    planDate: r.plan_date,
    associateId: r.associate_id,
    taskTypeId: r.task_type_id,
    equipmentId: r.equipment_id,
    dockDoorId: r.dock_door_id,
  }));
}

// --- Activity History (associate timeline) ----------------------------------

interface ActivityHistoryRow {
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

/** Activity for one associate in the range (dept/key filtered via the plan). */
export async function getActivityHistory(
  filter: HistoryFilter,
): Promise<ActivityHistory[]> {
  if (!filter.associateId) return [];
  const supabase = await db();
  let query = supabase
    .from('activity_history')
    .select(
      'id, daily_plan_id, associate_id, from_task_type_id, to_task_type_id, from_equipment_id, to_equipment_id, from_dock_door_id, to_dock_door_id, action_type, reason, changed_by, changed_at, daily_plans!inner(department_id, shift_key_id)',
    )
    .eq('associate_id', filter.associateId)
    .gte('changed_at', `${filter.range.from}T00:00:00`)
    .lte('changed_at', `${filter.range.to}T23:59:59.999`)
    .order('changed_at', { ascending: false })
    .limit(500);

  if (filter.departmentId)
    query = query.eq('daily_plans.department_id', filter.departmentId);
  if (filter.shiftKeyId)
    query = query.eq('daily_plans.shift_key_id', filter.shiftKeyId);

  const { data, error } = await query;
  if (error) fail('activity history', error.message);
  return ((data as ActivityHistoryRow[] | null) ?? []).map((r) => ({
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

// --- Unified detailed rows (planned + activity) -----------------------------

export interface HistoryRow {
  id: string;
  source: 'Planned' | 'Activity';
  date: string;
  associateId: string;
  departmentId: string | null;
  shiftKeyId: string | null;
  taskTypeId: string | null;
  equipmentId: string | null;
  action: string;
  actorId: string | null;
}

/** Planned + activity history merged into one detailed, sortable list (v2). */
export async function getHistoryRows(
  filter: HistoryFilter,
): Promise<HistoryRow[]> {
  const supabase = await db();

  // Planned rows carry dept/key/task/equipment directly; join the plan for actor.
  let plannedQ = supabase
    .from('planned_assignment_history')
    .select(
      'id, plan_date, associate_id, department_id, shift_key_id, task_type_id, equipment_id, daily_plans!inner(created_by)',
    )
    .gte('plan_date', filter.range.from)
    .lte('plan_date', filter.range.to)
    .order('plan_date', { ascending: false })
    .limit(1000);
  if (filter.departmentId)
    plannedQ = plannedQ.eq('department_id', filter.departmentId);
  if (filter.shiftKeyId)
    plannedQ = plannedQ.eq('shift_key_id', filter.shiftKeyId);
  if (filter.associateId)
    plannedQ = plannedQ.eq('associate_id', filter.associateId);
  if (filter.taskTypeId)
    plannedQ = plannedQ.eq('task_type_id', filter.taskTypeId);
  if (filter.equipmentId)
    plannedQ = plannedQ.eq('equipment_id', filter.equipmentId);

  // Activity rows get dept/key from the plan; use the "to" task/equipment.
  let activityQ = supabase
    .from('activity_history')
    .select(
      'id, changed_at, associate_id, to_task_type_id, to_equipment_id, action_type, changed_by, daily_plans!inner(department_id, shift_key_id)',
    )
    .gte('changed_at', `${filter.range.from}T00:00:00`)
    .lte('changed_at', `${filter.range.to}T23:59:59.999`)
    .order('changed_at', { ascending: false })
    .limit(1000);
  if (filter.associateId)
    activityQ = activityQ.eq('associate_id', filter.associateId);
  if (filter.departmentId)
    activityQ = activityQ.eq('daily_plans.department_id', filter.departmentId);
  if (filter.shiftKeyId)
    activityQ = activityQ.eq('daily_plans.shift_key_id', filter.shiftKeyId);
  if (filter.taskTypeId)
    activityQ = activityQ.eq('to_task_type_id', filter.taskTypeId);
  if (filter.equipmentId)
    activityQ = activityQ.eq('to_equipment_id', filter.equipmentId);

  const [plannedRes, activityRes] = await Promise.all([plannedQ, activityQ]);
  if (plannedRes.error) fail('planned history', plannedRes.error.message);
  if (activityRes.error) fail('activity history', activityRes.error.message);

  type PRow = {
    id: string;
    plan_date: string;
    associate_id: string;
    department_id: string | null;
    shift_key_id: string | null;
    task_type_id: string | null;
    equipment_id: string | null;
    daily_plans: { created_by: string | null } | null;
  };
  type ARow = {
    id: string;
    changed_at: string;
    associate_id: string;
    to_task_type_id: string | null;
    to_equipment_id: string | null;
    action_type: string;
    changed_by: string | null;
    daily_plans: {
      department_id: string | null;
      shift_key_id: string | null;
    } | null;
  };

  const planned: HistoryRow[] = (
    (plannedRes.data as unknown as PRow[] | null) ?? []
  ).map((r) => ({
    id: `p-${r.id}`,
    source: 'Planned',
    date: r.plan_date,
    associateId: r.associate_id,
    departmentId: r.department_id,
    shiftKeyId: r.shift_key_id,
    taskTypeId: r.task_type_id,
    equipmentId: r.equipment_id,
    action: 'Planned',
    actorId: r.daily_plans?.created_by ?? null,
  }));
  const activity: HistoryRow[] = (
    (activityRes.data as unknown as ARow[] | null) ?? []
  ).map((r) => ({
    id: `a-${r.id}`,
    source: 'Activity',
    date: r.changed_at.slice(0, 10),
    associateId: r.associate_id,
    departmentId: r.daily_plans?.department_id ?? null,
    shiftKeyId: r.daily_plans?.shift_key_id ?? null,
    taskTypeId: r.to_task_type_id,
    equipmentId: r.to_equipment_id,
    action: r.action_type,
    actorId: r.changed_by,
  }));

  return [...planned, ...activity].sort((a, b) => (a.date < b.date ? 1 : -1));
}

// --- Special-assignment summary ---------------------------------------------

export type SpecialSummary = Record<SpecialAssignmentType, number>;

export async function getSpecialSummary(
  filter: HistoryFilter,
): Promise<SpecialSummary> {
  const supabase = await db();
  let query = supabase
    .from('special_assignments')
    .select('type, daily_plans!inner(department_id, shift_key_id, plan_date)')
    .gte('daily_plans.plan_date', filter.range.from)
    .lte('daily_plans.plan_date', filter.range.to)
    .limit(5000);

  if (filter.departmentId)
    query = query.eq('daily_plans.department_id', filter.departmentId);
  if (filter.shiftKeyId)
    query = query.eq('daily_plans.shift_key_id', filter.shiftKeyId);
  if (filter.associateId) query = query.eq('associate_id', filter.associateId);

  const { data, error } = await query;
  if (error) fail('special summary', error.message);

  const summary: SpecialSummary = {
    overtime: 0,
    middle_mile: 0,
    icqa_support: 0,
    training: 0,
    support_outbound: 0,
  };
  for (const row of (data as { type: string }[] | null) ?? []) {
    if (row.type in summary) summary[row.type as SpecialAssignmentType] += 1;
  }
  return summary;
}
