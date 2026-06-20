import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  listAssociates,
  listDockDoors,
  listEquipment,
  listTasks,
  listCertificationsByAssociate,
} from '@/features/config/queries';
import { listTemplates } from '@/features/templates/queries';
import { addDaysISO, todayISO } from '@/lib/utils/date';
import type { RotationRecord } from './rotation';
import type {
  Assignment,
  Associate,
  CallOff,
  DailyPlan,
  DockDoor,
  EquipmentType,
  PlanTemplate,
  SpecialAssignment,
  TaskType,
} from '@/types/domain';
import {
  ABSENCE_TYPES,
  type AbsenceType,
  type AssignmentStatus,
  type AssignmentType,
  type PlanStatus,
  type SpecialAssignmentType,
} from '@/lib/constants/assignments';

function toAbsenceType(value: string): AbsenceType {
  return (ABSENCE_TYPES as readonly string[]).includes(value)
    ? (value as AbsenceType)
    : 'call_off';
}

/**
 * Read access for outbound planning (Phase 5). RLS scopes every result to the
 * caller's facility. Errors throw so the route error boundary renders.
 */

async function db() {
  return createClient();
}

function fail(entity: string, message: string): never {
  throw new Error(`Failed to load ${entity}: ${message}`);
}

// --- Plan inputs (associates / tasks / equipment / templates for a key) -----

export interface PlanInputs {
  associates: Associate[];
  tasks: TaskType[];
  equipment: EquipmentType[];
  dockDoors: DockDoor[];
  templates: PlanTemplate[];
  /** associateId → certified equipmentIds. */
  certificationsByAssociate: Record<string, string[]>;
}

/**
 * Everything needed to build a plan for a department + key: the eligible
 * associates (active, in the department, defaulting to this key), the
 * department's tasks, equipment, dock doors, active templates for the key, and
 * the certification map.
 */
export async function getPlanInputs(
  departmentId: string,
  shiftKeyId: string,
): Promise<PlanInputs> {
  const [associates, tasks, equipment, dockDoors, templates, certs] =
    await Promise.all([
      listAssociates(),
      listTasks(),
      listEquipment(),
      listDockDoors(),
      listTemplates(),
      listCertificationsByAssociate(),
    ]);

  return {
    associates: associates.filter(
      (a) =>
        a.active &&
        a.departmentId === departmentId &&
        a.defaultKeyId === shiftKeyId,
    ),
    tasks: tasks.filter((t) => t.departmentId === departmentId),
    equipment,
    dockDoors,
    templates: templates.filter(
      (t) =>
        t.active &&
        t.departmentId === departmentId &&
        t.shiftKeyId === shiftKeyId,
    ),
    certificationsByAssociate: certs,
  };
}

// --- Plans ------------------------------------------------------------------

interface PlanRow {
  id: string;
  facility_id: string;
  department_id: string;
  shift_key_id: string;
  plan_date: string;
  version: number;
  status: string;
  middle_mile_owner: string | null;
  created_by: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
}

function toPlan(r: PlanRow): DailyPlan {
  return {
    id: r.id,
    facilityId: r.facility_id,
    departmentId: r.department_id,
    shiftKeyId: r.shift_key_id,
    planDate: r.plan_date,
    version: r.version,
    status: r.status as PlanStatus,
    middleMileOwner:
      r.middle_mile_owner === 'outbound' || r.middle_mile_owner === 'inbound'
        ? r.middle_mile_owner
        : null,
    createdBy: r.created_by ?? '',
    publishedAt: r.published_at,
    closedAt: r.closed_at,
    createdAt: r.created_at,
  };
}

const PLAN_COLUMNS =
  'id, facility_id, department_id, shift_key_id, plan_date, version, status, middle_mile_owner, created_by, published_at, closed_at, created_at';

export async function getPlan(id: string): Promise<DailyPlan | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('daily_plans')
    .select(PLAN_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) fail('plan', error.message);
  return data ? toPlan(data as PlanRow) : null;
}

/** An existing active (draft/published) plan for this slot, or null. */
export async function findActivePlan(
  departmentId: string,
  shiftKeyId: string,
  planDate: string,
): Promise<DailyPlan | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('daily_plans')
    .select(PLAN_COLUMNS)
    .eq('department_id', departmentId)
    .eq('shift_key_id', shiftKeyId)
    .eq('plan_date', planDate)
    .in('status', ['draft', 'published'])
    .maybeSingle();
  if (error) fail('plan', error.message);
  return data ? toPlan(data as PlanRow) : null;
}

export async function listTodayPlans(): Promise<DailyPlan[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('daily_plans')
    .select(PLAN_COLUMNS)
    .eq('plan_date', todayISO())
    .order('created_at', { ascending: false });
  if (error) fail('plans', error.message);
  return ((data as PlanRow[] | null) ?? []).map(toPlan);
}

// --- Assignments ------------------------------------------------------------

interface AssignmentRow {
  id: string;
  daily_plan_id: string;
  associate_id: string;
  task_type_id: string | null;
  equipment_id: string | null;
  dock_door_id: string | null;
  assignment_type: string;
  status: string;
  notes: string | null;
  is_primary_planned: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export async function listPlanAssignments(
  planId: string,
): Promise<Assignment[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, daily_plan_id, associate_id, task_type_id, equipment_id, dock_door_id, assignment_type, status, notes, is_primary_planned, started_at, ended_at, created_at',
    )
    .eq('daily_plan_id', planId)
    .order('created_at');
  if (error) fail('assignments', error.message);
  return ((data as AssignmentRow[] | null) ?? []).map((r) => ({
    id: r.id,
    dailyPlanId: r.daily_plan_id,
    associateId: r.associate_id,
    taskTypeId: r.task_type_id,
    equipmentId: r.equipment_id,
    dockDoorId: r.dock_door_id,
    assignmentType: r.assignment_type as AssignmentType,
    status: r.status as AssignmentStatus,
    notes: r.notes,
    isPrimaryPlanned: r.is_primary_planned,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    createdAt: r.created_at,
  }));
}

// --- Call-offs --------------------------------------------------------------

interface CallOffRow {
  id: string;
  daily_plan_id: string;
  associate_id: string;
  type: string;
  reason: string | null;
  created_at: string;
}

export async function listCallOffs(planId: string): Promise<CallOff[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('call_offs')
    .select('id, daily_plan_id, associate_id, type, reason, created_at')
    .eq('daily_plan_id', planId);
  if (error) fail('call-offs', error.message);
  return ((data as CallOffRow[] | null) ?? []).map((r) => ({
    id: r.id,
    dailyPlanId: r.daily_plan_id,
    associateId: r.associate_id,
    type: toAbsenceType(r.type),
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

// --- Special assignments ----------------------------------------------------

interface SpecialRow {
  id: string;
  daily_plan_id: string;
  associate_id: string;
  type: string;
  task_type_id: string | null;
  equipment_id: string | null;
  dock_door_id: string | null;
  related_associate_id: string | null;
  notes: string | null;
  created_at: string;
}

// --- Rotation history (Phase 7) ---------------------------------------------

/**
 * Planned-history rows for the same department + key in the window before
 * `planDate` (PRD §7: rotation uses Planned Assignment History, not activity).
 * Used to steer auto-plan and to surface recent-repeat warnings.
 */
export async function getRotationRecords(
  departmentId: string,
  shiftKeyId: string,
  planDate: string,
  windowDays: number,
): Promise<RotationRecord[]> {
  const supabase = await db();
  const lowerBound = addDaysISO(planDate, -Math.max(1, windowDays));
  const { data, error } = await supabase
    .from('planned_assignment_history')
    .select('associate_id, task_type_id, plan_date')
    .eq('department_id', departmentId)
    .eq('shift_key_id', shiftKeyId)
    .gte('plan_date', lowerBound)
    .lt('plan_date', planDate);
  if (error) fail('rotation history', error.message);
  return (
    (data as
      | {
          associate_id: string;
          task_type_id: string | null;
          plan_date: string;
        }[]
      | null) ?? []
  ).map((r) => ({
    associateId: r.associate_id,
    taskTypeId: r.task_type_id,
    planDate: r.plan_date,
  }));
}

// --- Staffing needs (people per task) ---------------------------------------

export interface StaffingNeed {
  taskTypeId: string;
  peopleNeeded: number;
}

/** People-per-task demand a supervisor entered for this plan (v2). */
export async function listStaffingNeeds(
  planId: string,
): Promise<StaffingNeed[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('plan_staffing_needs')
    .select('task_type_id, people_needed')
    .eq('daily_plan_id', planId);
  if (error) fail('staffing needs', error.message);
  return (
    (data as { task_type_id: string; people_needed: number }[] | null) ?? []
  ).map((r) => ({ taskTypeId: r.task_type_id, peopleNeeded: r.people_needed }));
}

/** UPH calculation snapshot saved for this plan (per task). */
export interface UphCalculation {
  taskTypeId: string;
  unitsPlanned: number;
  uphUsed: number | null;
  shiftHoursUsed: number | null;
  recommendedPeople: number | null;
  finalPeople: number;
}

export async function listUphCalculations(
  planId: string,
): Promise<UphCalculation[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('plan_uph_calculations')
    .select(
      'task_type_id, units_planned, uph_used, shift_hours_used, recommended_people, final_people',
    )
    .eq('daily_plan_id', planId);
  if (error) fail('UPH calculations', error.message);
  type Row = {
    task_type_id: string;
    units_planned: number;
    uph_used: number | string | null;
    shift_hours_used: number | string | null;
    recommended_people: number | null;
    final_people: number;
  };
  return ((data as Row[] | null) ?? []).map((r) => ({
    taskTypeId: r.task_type_id,
    unitsPlanned: r.units_planned,
    uphUsed: r.uph_used === null ? null : Number(r.uph_used),
    shiftHoursUsed:
      r.shift_hours_used === null ? null : Number(r.shift_hours_used),
    recommendedPeople: r.recommended_people,
    finalPeople: r.final_people,
  }));
}

// --- Active dock doors (inbound) --------------------------------------------

/** Dock door ids the leader marked active for this plan (inbound Step 4). */
export async function listPlanDockDoors(planId: string): Promise<string[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('plan_dock_doors')
    .select('dock_door_id')
    .eq('daily_plan_id', planId);
  if (error) fail('active dock doors', error.message);
  return ((data as { dock_door_id: string }[] | null) ?? []).map(
    (r) => r.dock_door_id,
  );
}

/** Active dock door, each with the equipment chosen for it today (per plan). */
export interface PlanDockDoorRow {
  dockDoorId: string;
  equipmentId: string | null;
}

export async function listPlanDockDoorRows(
  planId: string,
): Promise<PlanDockDoorRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('plan_dock_doors')
    .select('dock_door_id, equipment_id')
    .eq('daily_plan_id', planId);
  if (error) fail('active dock doors', error.message);
  return (
    (data as { dock_door_id: string; equipment_id: string | null }[] | null) ??
    []
  ).map((r) => ({ dockDoorId: r.dock_door_id, equipmentId: r.equipment_id }));
}

export async function listSpecialAssignments(
  planId: string,
): Promise<SpecialAssignment[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('special_assignments')
    .select(
      'id, daily_plan_id, associate_id, type, task_type_id, equipment_id, dock_door_id, related_associate_id, notes, created_at',
    )
    .eq('daily_plan_id', planId)
    .order('created_at');
  if (error) fail('special assignments', error.message);
  return ((data as SpecialRow[] | null) ?? []).map((r) => ({
    id: r.id,
    dailyPlanId: r.daily_plan_id,
    associateId: r.associate_id,
    type: r.type as SpecialAssignmentType,
    taskTypeId: r.task_type_id,
    equipmentId: r.equipment_id,
    dockDoorId: r.dock_door_id,
    relatedAssociateId: r.related_associate_id,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}
