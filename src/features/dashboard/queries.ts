import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  listAssociates,
  listDepartments,
  listShiftKeys,
  listTasks,
} from '@/features/config/queries';
import { todayISO } from '@/lib/utils/date';
import type { DailyPlan } from '@/types/domain';
import type { DepartmentKind } from '@/lib/constants/departments';
import {
  ASSIGNMENT_STATUS_LABELS,
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
