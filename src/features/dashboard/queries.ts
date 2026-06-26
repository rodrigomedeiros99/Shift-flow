import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  listAssociates,
  listDepartments,
  listDockDoors,
  listShiftKeys,
  listTasks,
} from '@/features/config/queries';
import { todayISO } from '@/lib/utils/date';
import type { ActivityHistory, DailyPlan } from '@/types/domain';
import type { DepartmentKind } from '@/lib/constants/departments';
import {
  ASSIGNMENT_STATUS_LABELS,
  type ActivityAction,
  type AssignmentStatus,
} from '@/lib/constants/assignments';

/**
 * Dashboard aggregates (v2). Read-only; RLS scopes everything to the facility.
 * Filtered by department kind, shift key, and date.
 */

async function db() {
  return createClient();
}

export interface DashboardFilter {
  deptKind: '' | DepartmentKind;
  shiftKeyId: string;
  date: string;
}

export interface DashboardData {
  date: string;
  totals: {
    associates: number;
    assigned: number;
    callOffs: number;
    overtime: number;
  };
  plans: {
    id: string;
    departmentName: string;
    keyName: string;
    status: DailyPlan['status'];
  }[];
  byStatus: { label: string; value: number }[];
  byTask: { label: string; value: number }[];
}

interface PlanRow {
  id: string;
  department_id: string;
  shift_key_id: string;
  status: string;
}

export async function getDashboardData(
  filter: DashboardFilter,
): Promise<DashboardData> {
  const supabase = await db();
  const date = filter.date || todayISO();

  const [departments, shiftKeys, associates, tasks] = await Promise.all([
    listDepartments(),
    listShiftKeys(),
    listAssociates(),
    listTasks(),
  ]);

  const deptKind = new Map(departments.map((d) => [d.id, d.kind]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const keyName = new Map(shiftKeys.map((k) => [k.id, k.name]));
  const taskName = new Map(tasks.map((t) => [t.id, t.name]));

  const inScopeDept = (departmentId: string) =>
    !filter.deptKind || deptKind.get(departmentId) === filter.deptKind;

  // Plans for the date, filtered by dept kind + key.
  const { data: planRows } = await supabase
    .from('daily_plans')
    .select('id, department_id, shift_key_id, status')
    .eq('plan_date', date)
    .order('created_at', { ascending: false });

  const plansAll = (planRows as PlanRow[] | null) ?? [];
  const plans = plansAll.filter(
    (p) =>
      inScopeDept(p.department_id) &&
      (!filter.shiftKeyId || p.shift_key_id === filter.shiftKeyId),
  );
  const planIds = plans.map((p) => p.id);

  // Associates total (active), filtered by dept kind + key.
  const associatesInScope = associates.filter(
    (a) =>
      a.active &&
      inScopeDept(a.departmentId) &&
      (!filter.shiftKeyId || a.defaultKeyId === filter.shiftKeyId),
  );

  // Aggregate over the in-scope plans.
  const byStatusCount = new Map<string, number>();
  const byTaskCount = new Map<string, number>();
  let assigned = 0;
  let callOffs = 0;
  let overtime = 0;

  if (planIds.length > 0) {
    const [aRes, cRes, sRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('status, task_type_id')
        .in('daily_plan_id', planIds),
      supabase.from('call_offs').select('id').in('daily_plan_id', planIds),
      supabase
        .from('special_assignments')
        .select('id')
        .in('daily_plan_id', planIds)
        .eq('type', 'overtime'),
    ]);

    const aRows =
      (aRes.data as { status: string; task_type_id: string | null }[] | null) ??
      [];
    assigned = aRows.length;
    for (const r of aRows) {
      byStatusCount.set(r.status, (byStatusCount.get(r.status) ?? 0) + 1);
      const key = r.task_type_id ?? 'none';
      byTaskCount.set(key, (byTaskCount.get(key) ?? 0) + 1);
    }
    callOffs = (cRes.data as { id: string }[] | null)?.length ?? 0;
    overtime = (sRes.data as { id: string }[] | null)?.length ?? 0;
  }

  const byStatus = [...byStatusCount.entries()].map(([status, value]) => ({
    label: ASSIGNMENT_STATUS_LABELS[status as AssignmentStatus] ?? status,
    value,
  }));
  const byTask = [...byTaskCount.entries()]
    .map(([id, value]) => ({
      label: id === 'none' ? 'Unassigned' : (taskName.get(id) ?? '—'),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    date,
    totals: {
      associates: associatesInScope.length,
      assigned,
      callOffs,
      overtime,
    },
    plans: plans.map((p) => ({
      id: p.id,
      departmentName: deptName.get(p.department_id) ?? '—',
      keyName: keyName.get(p.shift_key_id) ?? '—',
      status: p.status as DailyPlan['status'],
    })),
    byStatus,
    byTask,
  };
}

// --- Recent activity (today, across the facility's plans) -------------------

export interface RecentActivityResult {
  items: ActivityHistory[];
  nameOf: Map<string, string>;
  taskName: Map<string, string>;
  doorName: Map<string, string>;
  /** daily_plan_id → label + link, for plan context on each row. */
  planContext: Map<string, { label: string; href: string }>;
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

/**
 * The latest operational changes from today across every plan the caller can
 * see (RLS-scoped), newest first. Powers the Dashboard "Recent activity"
 * section with the same shape the Live timeline uses, plus plan context + link.
 */
export async function getRecentActivity(
  limit = 8,
): Promise<RecentActivityResult> {
  const supabase = await db();
  const date = todayISO();

  const [departments, shiftKeys, associates, tasks, dockDoors] =
    await Promise.all([
      listDepartments(),
      listShiftKeys(),
      listAssociates(),
      listTasks(),
      listDockDoors(),
    ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const keyName = new Map(shiftKeys.map((k) => [k.id, k.name]));
  const nameOf = new Map(
    associates.map((a) => [a.id, `${a.firstName} ${a.lastName}`]),
  );
  const taskName = new Map(tasks.map((t) => [t.id, t.name]));
  const doorName = new Map(dockDoors.map((d) => [d.id, d.doorNumber]));

  const { data: planRows } = await supabase
    .from('daily_plans')
    .select('id, department_id, shift_key_id, status')
    .eq('plan_date', date);
  const plans = (planRows as PlanRow[] | null) ?? [];

  const planContext = new Map<string, { label: string; href: string }>();
  for (const p of plans) {
    planContext.set(p.id, {
      label: `${deptName.get(p.department_id) ?? '—'} · ${keyName.get(p.shift_key_id) ?? '—'}`,
      href:
        p.status === 'published'
          ? `/live-plan/${p.id}`
          : `/create-plan/${p.id}`,
    });
  }

  const planIds = plans.map((p) => p.id);
  if (planIds.length === 0) {
    return { items: [], nameOf, taskName, doorName, planContext };
  }

  const { data } = await supabase
    .from('activity_history')
    .select(
      'id, daily_plan_id, associate_id, from_task_type_id, to_task_type_id, from_equipment_id, to_equipment_id, from_dock_door_id, to_dock_door_id, action_type, reason, changed_by, changed_at',
    )
    .in('daily_plan_id', planIds)
    .order('changed_at', { ascending: false })
    .limit(limit);

  const items: ActivityHistory[] = ((data as ActivityRow[] | null) ?? []).map(
    (r) => ({
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
    }),
  );

  return { items, nameOf, taskName, doorName, planContext };
}
