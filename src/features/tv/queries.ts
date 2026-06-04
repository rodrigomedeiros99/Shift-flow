import 'server-only';

import {
  listAssociates,
  listDepartments,
  listDockDoors,
  listEquipment,
  listShiftKeys,
  listTasks,
} from '@/features/config/queries';
import {
  listCallOffs,
  listPlanAssignments,
  listPlanDockDoors,
  listSpecialAssignments,
  listTodayPlans,
} from '@/features/planning/queries';
import { todayISO } from '@/lib/utils/date';
import type { DepartmentKind } from '@/lib/constants/departments';
import type {
  AssignmentStatus,
  SpecialAssignmentType,
} from '@/lib/constants/assignments';
import type { Associate, DailyPlan } from '@/types/domain';

/**
 * Read model for TV Mode (Phase 8). Aggregates today's *published* plans into
 * large, read-only view models grouped the same way the review board groups
 * them (outbound by task, inbound by dock door). RLS scopes every underlying
 * query to the caller's facility.
 */

const SPECIAL_LABELS: Record<SpecialAssignmentType, string> = {
  overtime: 'Overtime',
  middle_mile: 'Middle Mile',
  icqa_support: 'ICQA Support',
  training: 'Training',
  support_outbound: 'Support Outbound',
};

export interface TvCard {
  assignmentId: string;
  associateName: string;
  taskName: string | null;
  equipmentName: string | null;
  doorNumber: string | null;
  status: AssignmentStatus;
}

export interface TvGroup {
  key: string;
  label: string;
  cards: TvCard[];
}

export interface TvSpecial {
  id: string;
  label: string;
  associateName: string;
  relatedName: string | null;
  taskName: string | null;
}

export interface TvPlanView {
  planId: string;
  departmentName: string;
  kind: DepartmentKind;
  shiftKeyName: string;
  groups: TvGroup[];
  specials: TvSpecial[];
  activeDoorNumbers: string[];
  pool: string[];
  middleMileOwner: 'outbound' | 'inbound' | null;
}

export interface TvBoard {
  planDate: string;
  outbound: TvPlanView[];
  inbound: TvPlanView[];
}

const fullName = (a: Associate) => `${a.firstName} ${a.lastName}`;

export async function getTvBoard(): Promise<TvBoard> {
  const [
    plans,
    departments,
    shiftKeys,
    associates,
    tasks,
    equipment,
    dockDoors,
  ] = await Promise.all([
    listTodayPlans(),
    listDepartments(),
    listShiftKeys(),
    listAssociates(),
    listTasks(),
    listEquipment(),
    listDockDoors(),
  ]);

  const deptById = new Map(departments.map((d) => [d.id, d]));
  const keyName = new Map(shiftKeys.map((k) => [k.id, k.name]));
  const nameOf = new Map(associates.map((a) => [a.id, fullName(a)]));
  const taskName = new Map(tasks.map((t) => [t.id, t.name]));
  const equipName = new Map(equipment.map((e) => [e.id, e.name]));
  const doorNumber = new Map(dockDoors.map((d) => [d.id, d.doorNumber]));
  // Stable group ordering: dock doors, then tasks (by their configured order).
  const doorOrder = dockDoors.map((d) => d.id);
  const taskOrder = tasks.map((t) => t.id);

  const published = plans.filter((p) => p.status === 'published');

  const views = await Promise.all(
    published.map((plan) =>
      buildPlanView(plan, {
        deptById,
        keyName,
        nameOf,
        taskName,
        equipName,
        doorNumber,
        doorOrder,
        taskOrder,
        associates,
      }),
    ),
  );

  return {
    planDate: todayISO(),
    outbound: views.filter((v) => v.kind !== 'inbound'),
    inbound: views.filter((v) => v.kind === 'inbound'),
  };
}

interface BuildContext {
  deptById: Map<string, { name: string; kind: DepartmentKind }>;
  keyName: Map<string, string>;
  nameOf: Map<string, string>;
  taskName: Map<string, string>;
  equipName: Map<string, string>;
  doorNumber: Map<string, string>;
  doorOrder: string[];
  taskOrder: string[];
  associates: Associate[];
}

async function buildPlanView(
  plan: DailyPlan,
  ctx: BuildContext,
): Promise<TvPlanView> {
  const [assignments, specials, activeDoorIds, callOffs] = await Promise.all([
    listPlanAssignments(plan.id),
    listSpecialAssignments(plan.id),
    listPlanDockDoors(plan.id),
    listCallOffs(plan.id),
  ]);

  const dept = ctx.deptById.get(plan.departmentId);
  const kind: DepartmentKind = dept?.kind ?? 'other';
  const isInbound = kind === 'inbound';

  // Group cards: inbound by active door (door-less ops by task), outbound by task.
  const buckets = new Map<string, TvCard[]>();
  for (const a of assignments) {
    const key =
      isInbound && a.dockDoorId
        ? `door:${a.dockDoorId}`
        : `task:${a.taskTypeId ?? 'none'}`;
    const card: TvCard = {
      assignmentId: a.id,
      associateName: ctx.nameOf.get(a.associateId) ?? '—',
      taskName: a.taskTypeId ? (ctx.taskName.get(a.taskTypeId) ?? '—') : null,
      equipmentName: a.equipmentId
        ? (ctx.equipName.get(a.equipmentId) ?? '—')
        : null,
      doorNumber: a.dockDoorId
        ? (ctx.doorNumber.get(a.dockDoorId) ?? '—')
        : null,
      status: a.status,
    };
    const arr = buckets.get(key);
    if (arr) arr.push(card);
    else buckets.set(key, [card]);
  }

  const orderedKeys = [
    ...ctx.doorOrder.map((id) => `door:${id}`).filter((k) => buckets.has(k)),
    ...ctx.taskOrder.map((id) => `task:${id}`).filter((k) => buckets.has(k)),
    ...(buckets.has('task:none') ? ['task:none'] : []),
  ];
  const groups: TvGroup[] = orderedKeys.map((key) => ({
    key,
    label: key.startsWith('door:')
      ? `Door ${ctx.doorNumber.get(key.slice(5)) ?? '—'}`
      : key === 'task:none'
        ? 'Unassigned'
        : (ctx.taskName.get(key.slice(5)) ?? '—'),
    cards: buckets.get(key) ?? [],
  }));

  const specialViews: TvSpecial[] = specials.map((s) => ({
    id: s.id,
    label: SPECIAL_LABELS[s.type],
    associateName: ctx.nameOf.get(s.associateId) ?? '—',
    relatedName: s.relatedAssociateId
      ? (ctx.nameOf.get(s.relatedAssociateId) ?? '—')
      : null,
    taskName: s.taskTypeId ? (ctx.taskName.get(s.taskTypeId) ?? '—') : null,
  }));

  // Available pool = eligible associates not assigned, called off, or special.
  const used = new Set<string>();
  for (const a of assignments) used.add(a.associateId);
  for (const c of callOffs) used.add(c.associateId);
  for (const s of specials) {
    used.add(s.associateId);
    if (s.relatedAssociateId) used.add(s.relatedAssociateId);
  }
  const pool = ctx.associates
    .filter(
      (a) =>
        a.active &&
        a.departmentId === plan.departmentId &&
        a.defaultKeyId === plan.shiftKeyId &&
        !used.has(a.id),
    )
    .map((a) => fullName(a));

  return {
    planId: plan.id,
    departmentName: dept?.name ?? 'Plan',
    kind,
    shiftKeyName: ctx.keyName.get(plan.shiftKeyId) ?? '',
    groups,
    specials: specialViews,
    activeDoorNumbers: activeDoorIds
      .map((id) => ctx.doorNumber.get(id) ?? '')
      .filter((n) => n.length > 0),
    pool,
    middleMileOwner: plan.middleMileOwner,
  };
}
