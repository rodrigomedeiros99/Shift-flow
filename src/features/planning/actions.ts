'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import {
  findActivePlan,
  getPlan,
  getPlanInputs,
  getRotationRecords,
  listCallOffs,
  listPlanAssignments,
  listPlanDockDoorRows,
  listSpecialAssignments,
  listStaffingNeeds,
} from './queries';
import { generateAssignments, type GenStaffingItem } from './generate';
import {
  buildRotationIndex,
  recentConflictDate,
  scoreAssignments,
} from './rotation';
import { logAudit } from '@/features/audit/log';
import {
  clearNotificationsByDedupe,
  emitNotifications,
  loadPlanLabel,
  type EmitContext,
} from '@/features/notifications/emit';
import {
  buildDraftExists,
  buildPlanPublished,
  buildRotationAlert,
  buildStaffingWarning,
  buildUphWarning,
  type NotificationDraft,
  type RotationConflict,
  type StaffingShortfall,
  type UphDelta,
} from '@/features/notifications/generate';
import type { StaffingNeed, PlanDockDoorRow } from './queries';
import type { DailyPlan, TaskType } from '@/types/domain';
import {
  activeDoorsSchema,
  assignmentEditSchema,
  overtimeEntrySchema,
  planSetupSchema,
  specialAssignmentSchema,
  staffingNeedsSchema,
  trainingPairSchema,
} from './schemas';
import type {
  ActionResult,
  CreateDraftResult,
  GenerateResult,
  WarnResult,
} from './types';
import type {
  AbsenceType,
  AssignmentType,
  SpecialAssignmentType,
} from '@/lib/constants/assignments';

/**
 * Outbound planning mutations (Phase 5). Every action re-authorizes (planner
 * role) and re-validates input server-side; RLS is the second gate. Published
 * plans are read-only — write actions guard `status === 'draft'`.
 */

const ok: ActionResult = { ok: true };
function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}
function dbFail(): { ok: false; error: string } {
  return fail('Could not save changes. Please try again.');
}

/** '' (no selection) → null for nullable foreign keys. */
function nullable(value: string): string | null {
  return value === '' ? null : value;
}

/** Friendly message when an associate already holds an active assignment. */
const DUPLICATE_ASSIGNMENT_MESSAGE =
  'That associate is already assigned in this plan. Use Switch or Move to change their task instead of assigning them twice.';

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

/**
 * Whether `associateId` already has an active (non-completed) assignment in this
 * plan — the invariant the no-duplicate index enforces. `excludeId` skips the
 * row being edited so updating an existing assignment doesn't flag itself.
 */
async function hasActiveAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  associateId: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from('assignments')
    .select('id')
    .eq('daily_plan_id', planId)
    .eq('associate_id', associateId)
    .neq('status', 'completed');
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query.limit(1).maybeSingle();
  return data !== null;
}

/** Guard that a plan exists and is still an editable draft. */
async function requireDraft(
  planId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft')
    return fail('This plan is published and read-only.');
  return ok;
}

/**
 * Certification warning for assigning `associateId` to `equipmentId`: null when
 * fine, otherwise a human-readable warning. Used to warn-but-allow on manual
 * edits/switches (the leader stays in control).
 */
async function certWarning(
  associateId: string,
  equipmentId: string | null,
): Promise<string | null> {
  if (!equipmentId) return null;
  const supabase = await createClient();

  const { data: equip } = await supabase
    .from('equipment_types')
    .select('name, certification_required')
    .eq('id', equipmentId)
    .maybeSingle();
  const e = equip as { name: string; certification_required: boolean } | null;
  if (!e || !e.certification_required) return null;

  const { data: cert } = await supabase
    .from('associate_certifications')
    .select('certified')
    .eq('associate_id', associateId)
    .eq('equipment_id', equipmentId)
    .eq('certified', true)
    .maybeSingle();
  if (cert) return null;

  return `Associate is not certified on ${e.name}.`;
}

/** Default rotation lookback (PRD §7): the previous day. */
const DEFAULT_LOOKBACK = 1;

/**
 * Rotation warning for planning `associateId` onto `taskTypeId`: null when fine,
 * otherwise a human-readable notice that the associate was planned for the same
 * task within the lookback window (PRD §7). Non-blocking — the leader overrides.
 */
async function rotationWarning(
  plan: DailyPlan,
  associateId: string,
  taskTypeId: string | null,
  lookbackDays: number,
): Promise<string | null> {
  if (!taskTypeId) return null;
  const records = await getRotationRecords(
    plan.departmentId,
    plan.shiftKeyId,
    plan.planDate,
    lookbackDays,
  );
  const date = recentConflictDate(
    buildRotationIndex(records),
    associateId,
    taskTypeId,
    plan.planDate,
    lookbackDays,
  );
  if (!date) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('task_types')
    .select('name')
    .eq('id', taskTypeId)
    .maybeSingle();
  const taskName = (data as { name: string } | null)?.name ?? 'this task';
  return `Recently planned for ${taskName} on ${date}.`;
}

/** Merge non-null warnings into one space-joined string (or undefined). */
function mergeWarnings(...parts: (string | null)[]): string | undefined {
  const joined = parts.filter((p): p is string => !!p).join(' ');
  return joined.length > 0 ? joined : undefined;
}

// --- Notification emission ---------------------------------------------------

/** Resolve task names for the given ids (for notification messages). */
async function taskNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from('task_types')
    .select('id, name')
    .in('id', unique);
  return new Map(
    ((data as { id: string; name: string }[] | null) ?? []).map((r) => [
      r.id,
      r.name,
    ]),
  );
}

/** Needed-vs-assigned shortfalls per task (door demand = one position per door). */
function computeStaffingShortfalls(
  tasks: TaskType[],
  staffingNeeds: StaffingNeed[],
  activeDoors: PlanDockDoorRow[],
  assignedTaskIds: (string | null)[],
): StaffingShortfall[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const doorTasks = tasks.filter((t) => t.needsDockDoor && t.active);
  const soleDoorTask = doorTasks.length === 1 ? doorTasks[0] : undefined;
  const doorTaskFor = (equipmentId: string | null): string | null => {
    if (equipmentId) {
      const m = doorTasks.find((t) => t.defaultEquipmentId === equipmentId);
      if (m) return m.id;
    }
    return soleDoorTask?.id ?? null;
  };
  const doorTaskIds = new Set(doorTasks.map((t) => t.id));

  const needed = new Map<string, number>();
  for (const n of staffingNeeds) {
    if (!doorTaskIds.has(n.taskTypeId)) {
      needed.set(
        n.taskTypeId,
        (needed.get(n.taskTypeId) ?? 0) + n.peopleNeeded,
      );
    }
  }
  for (const d of activeDoors) {
    const tid = doorTaskFor(d.equipmentId);
    if (tid) needed.set(tid, (needed.get(tid) ?? 0) + 1);
  }

  const assigned = new Map<string, number>();
  for (const tid of assignedTaskIds) {
    if (tid) assigned.set(tid, (assigned.get(tid) ?? 0) + 1);
  }

  const out: StaffingShortfall[] = [];
  for (const [tid, need] of needed) {
    const got = assigned.get(tid) ?? 0;
    if (got < need) {
      out.push({
        taskName: taskById.get(tid)?.name ?? 'Task',
        needed: need,
        assigned: got,
      });
    }
  }
  return out;
}

/**
 * Reconcile a set of conditions: emit the present drafts, and clear the dedupe
 * key of any condition that resolved (null draft) so a fixed plan doesn't keep a
 * stale warning. Each entry's clear key is the draft's own `dedupeKey`.
 */
async function applyNotifications(
  ctx: EmitContext,
  entries: { key: string; draft: NotificationDraft | null }[],
): Promise<void> {
  const emit = entries
    .map((e) => e.draft)
    .filter((d): d is NotificationDraft => d !== null);
  const clear = entries.filter((e) => e.draft === null).map((e) => e.key);
  await emitNotifications(ctx, emit);
  await clearNotificationsByDedupe(ctx.facilityId, clear);
}

// --- Create / setup ---------------------------------------------------------

export async function createDraftPlan(
  input: z.input<typeof planSetupSchema>,
): Promise<CreateDraftResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const parsed = planSetupSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const existing = await findActivePlan(
    parsed.data.departmentId,
    parsed.data.shiftKeyId,
    parsed.data.planDate,
  );
  if (existing) {
    return { ok: false, code: 'duplicate', existingId: existing.id };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_plans')
    .insert({
      facility_id: profile.facilityId,
      department_id: parsed.data.departmentId,
      shift_key_id: parsed.data.shiftKeyId,
      plan_date: parsed.data.planDate,
      status: 'draft',
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    // Lost a race against the partial-unique index → surface as duplicate.
    if ((error as { code?: string } | null)?.code === '23505') {
      const dup = await findActivePlan(
        parsed.data.departmentId,
        parsed.data.shiftKeyId,
        parsed.data.planDate,
      );
      if (dup) return { ok: false, code: 'duplicate', existingId: dup.id };
    }
    return dbFail();
  }

  const newId = (data as { id: string }).id;
  await logAudit({
    actionType: 'create_plan',
    entityType: 'daily_plan',
    entityId: newId,
    dailyPlanId: newId,
    newValue: {
      departmentId: parsed.data.departmentId,
      shiftKeyId: parsed.data.shiftKeyId,
      planDate: parsed.data.planDate,
    },
  });

  // One draft notification per plan (deduped); auto-clears when the draft is
  // deleted (FK cascade) or published.
  const label = await loadPlanLabel({
    id: newId,
    departmentId: parsed.data.departmentId,
    shiftKeyId: parsed.data.shiftKeyId,
  });
  await emitNotifications(
    {
      facilityId: profile.facilityId,
      recipientUserId: profile.id,
      dailyPlanId: newId,
    },
    [buildDraftExists(label)],
  );

  revalidatePath('/dashboard');
  return { ok: true, id: newId };
}

/**
 * Delete an unfinished DRAFT plan. Only drafts are deletable (published/closed
 * are rejected); a manager (admin/supervisor) or the draft's creator may do it.
 * Child rows cascade; drafts have no planned/activity history to lose.
 */
export async function deleteDraftPlan(planId: string): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft') return fail('Only draft plans can be deleted.');

  const isManager = profile.role === 'admin' || profile.role === 'supervisor';
  if (!isManager && plan.createdBy !== profile.id) {
    return fail('You can only delete drafts you created.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('daily_plans')
    .delete()
    .eq('id', planId)
    .eq('status', 'draft');
  if (error) return dbFail();

  // entity_id (plain uuid) survives; daily_plan_id FK would be nulled on delete.
  await logAudit({
    actionType: 'delete_draft',
    entityType: 'daily_plan',
    entityId: planId,
  });
  revalidatePath('/dashboard');
  revalidatePath('/create-plan');
  return ok;
}

// --- Morning wizard ---------------------------------------------------------

/**
 * Replace the plan's absences of a single type (call-off / vacation /
 * scheduled-time-off). Only the given type's rows are replaced; checking an
 * associate already absent under another type moves them (upsert on the
 * plan+associate unique key). All types remove the associate from planning.
 */
export async function saveCallOffs(
  planId: string,
  associateIds: string[],
  type: AbsenceType = 'call_off',
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('call_offs')
    .delete()
    .eq('daily_plan_id', planId)
    .eq('type', type);
  if (delError) return dbFail();

  if (associateIds.length > 0) {
    const rows = associateIds.map((associateId) => ({
      daily_plan_id: planId,
      associate_id: associateId,
      type,
      created_by: profile.id,
    }));
    const { error: insError } = await supabase
      .from('call_offs')
      .upsert(rows, { onConflict: 'daily_plan_id,associate_id' });
    if (insError) return dbFail();
  }

  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

/**
 * Replace the plan's "not available" associates in one set. The reason for being
 * out (call-off / vacation / time off) doesn't matter for plan generation, so all
 * are stored uniformly and excluded from the available pool.
 */
export async function saveNotAvailable(
  planId: string,
  associateIds: string[],
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('call_offs')
    .delete()
    .eq('daily_plan_id', planId);
  if (delError) return dbFail();

  if (associateIds.length > 0) {
    const rows = associateIds.map((associateId) => ({
      daily_plan_id: planId,
      associate_id: associateId,
      type: 'call_off',
      created_by: profile.id,
    }));
    const { error: insError } = await supabase.from('call_offs').insert(rows);
    if (insError) return dbFail();
  }

  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

/** Replace the plan's active dock doors + their per-day equipment (Step 4). */
export async function saveActiveDoors(
  planId: string,
  doors: z.input<typeof activeDoorsSchema>['doors'],
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;
  const parsed = activeDoorsSchema.safeParse({ doors });
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('plan_dock_doors')
    .delete()
    .eq('daily_plan_id', planId);
  if (delError) return dbFail();

  if (parsed.data.doors.length > 0) {
    const rows = parsed.data.doors.map((d) => ({
      daily_plan_id: planId,
      dock_door_id: d.dockDoorId,
      equipment_id: nullable(d.equipmentId),
    }));
    const { error: insError } = await supabase
      .from('plan_dock_doors')
      .insert(rows);
    if (insError) return dbFail();
  }

  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

async function insertSpecial(
  planId: string,
  type: SpecialAssignmentType,
  row: {
    associate_id: string;
    task_type_id?: string | null;
    equipment_id?: string | null;
    related_associate_id?: string | null;
    notes?: string | null;
  },
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { error } = await supabase.from('special_assignments').insert({
    daily_plan_id: planId,
    type,
    ...row,
  });
  if (error) return dbFail();
  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

export async function addOvertime(
  planId: string,
  input: z.input<typeof overtimeEntrySchema>,
): Promise<ActionResult> {
  const parsed = overtimeEntrySchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');
  return insertSpecial(planId, 'overtime', {
    associate_id: parsed.data.associateId,
    task_type_id: parsed.data.taskTypeId,
    equipment_id: nullable(parsed.data.equipmentId),
    notes: parsed.data.notes || null,
  });
}

export async function addSpecialAssignment(
  planId: string,
  type: Extract<
    SpecialAssignmentType,
    'middle_mile' | 'icqa_support' | 'support_outbound'
  >,
  input: z.input<typeof specialAssignmentSchema>,
): Promise<ActionResult> {
  const parsed = specialAssignmentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');
  return insertSpecial(planId, type, {
    associate_id: parsed.data.associateId,
    task_type_id: nullable(parsed.data.taskTypeId),
    equipment_id: nullable(parsed.data.equipmentId),
    notes: parsed.data.notes || null,
  });
}

export async function addTrainingPair(
  planId: string,
  input: z.input<typeof trainingPairSchema>,
): Promise<ActionResult> {
  const parsed = trainingPairSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');
  return insertSpecial(planId, 'training', {
    associate_id: parsed.data.associateId,
    related_associate_id: parsed.data.relatedAssociateId,
    task_type_id: parsed.data.taskTypeId,
    equipment_id: nullable(parsed.data.equipmentId),
    notes: parsed.data.notes || null,
  });
}

export async function setMiddleMileOwner(
  planId: string,
  owner: 'outbound' | 'inbound',
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  // Switching to Inbound clears any outbound Middle Mile people for the plan.
  if (owner === 'inbound') {
    const { error: delError } = await supabase
      .from('special_assignments')
      .delete()
      .eq('daily_plan_id', planId)
      .eq('type', 'middle_mile');
    if (delError) return dbFail();
  }
  const { error } = await supabase
    .from('daily_plans')
    .update({ middle_mile_owner: owner })
    .eq('id', planId);
  if (error) return dbFail();
  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

export async function removeSpecialAssignment(
  id: string,
  planId: string,
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from('special_assignments')
    .delete()
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

// --- Staffing needs ---------------------------------------------------------

/** Save people-per-task demand for the plan (v2 replaces template selection). */
export async function saveStaffingNeeds(
  planId: string,
  input: z.input<typeof staffingNeedsSchema>,
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;
  const parsed = staffingNeedsSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('plan_staffing_needs')
    .delete()
    .eq('daily_plan_id', planId);
  if (delError) return dbFail();

  const rows = parsed.data.rows
    .filter((r) => r.peopleNeeded > 0)
    .map((r) => ({
      daily_plan_id: planId,
      task_type_id: r.taskTypeId,
      people_needed: r.peopleNeeded,
    }));
  if (rows.length > 0) {
    const { error: insError } = await supabase
      .from('plan_staffing_needs')
      .insert(rows);
    if (insError) return dbFail();
  }

  // UPH snapshot — preserved per task so old plans keep the UPH used at creation
  // even after Settings change. Only rows with units entered are meaningful.
  const { error: delUphError } = await supabase
    .from('plan_uph_calculations')
    .delete()
    .eq('daily_plan_id', planId);
  if (delUphError) return dbFail();

  const uphRows = parsed.data.uph
    .filter((r) => r.unitsPlanned > 0)
    .map((r) => ({
      daily_plan_id: planId,
      task_type_id: r.taskTypeId,
      units_planned: r.unitsPlanned,
      uph_used: r.uphUsed,
      shift_hours_used: r.shiftHoursUsed,
      recommended_people: r.recommendedPeople,
      final_people: r.finalPeople,
    }));
  if (uphRows.length > 0) {
    const { error: insUphError } = await supabase
      .from('plan_uph_calculations')
      .insert(uphRows);
    if (insUphError) return dbFail();
  }

  // UPH variance notification — flag tasks whose final staffing diverges from
  // the UPH recommendation by the threshold. Re-evaluated each save; cleared
  // when nothing diverges (so a corrected plan drops the warning).
  const plan = await getPlan(planId);
  if (plan) {
    const withRec = parsed.data.uph.filter((r) => r.recommendedPeople !== null);
    const names = await taskNames(withRec.map((r) => r.taskTypeId));
    const deltas: UphDelta[] = withRec.map((r) => ({
      taskName: names.get(r.taskTypeId) ?? 'Task',
      recommended: r.recommendedPeople as number,
      staffed: r.finalPeople,
    }));
    const label = await loadPlanLabel(plan);
    await applyNotifications(
      {
        facilityId: plan.facilityId,
        recipientUserId: plan.createdBy,
        dailyPlanId: plan.id,
      },
      [{ key: `uph:${planId}`, draft: buildUphWarning(label, deltas) }],
    );
  }

  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

// --- Auto-generate ----------------------------------------------------------

export async function autoGeneratePlan(
  planId: string,
  lookbackDays: number = DEFAULT_LOOKBACK,
): Promise<GenerateResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft')
    return fail('This plan is published and read-only.');

  const [
    inputs,
    callOffs,
    specials,
    activeDoors,
    staffingNeeds,
    rotationRecords,
  ] = await Promise.all([
    getPlanInputs(plan.departmentId, plan.shiftKeyId),
    listCallOffs(planId),
    listSpecialAssignments(planId),
    listPlanDockDoorRows(planId),
    listStaffingNeeds(planId),
    // 30-day window: lookback drives recent-repeat avoidance; the full window
    // feeds the least-frequently-assigned tie-break.
    getRotationRecords(plan.departmentId, plan.shiftKeyId, plan.planDate, 30),
  ]);

  const rotationIndex = buildRotationIndex(rotationRecords);

  // Associates already committed elsewhere are unavailable for the normal fill.
  const committed = new Set<string>();
  for (const c of callOffs) committed.add(c.associateId);
  for (const s of specials) {
    committed.add(s.associateId);
    if (s.relatedAssociateId) committed.add(s.relatedAssociateId);
  }

  const availableAssociates = inputs.associates
    .filter((a) => !committed.has(a.id))
    .map((a) => ({
      id: a.id,
      certifiedEquipmentIds: inputs.certificationsByAssociate[a.id] ?? [],
    }));

  // Each staffing need's slots default to that task's configured equipment.
  const equipForTask = new Map(
    inputs.tasks.map((t) => [t.id, t.defaultEquipmentId]),
  );
  // Door-driven tasks (Unload) are staffed from active doors below, never from a
  // people count — so exclude them from staffing slots even if a stale need row
  // exists.
  const doorTaskIds = new Set(
    inputs.tasks.filter((t) => t.needsDockDoor).map((t) => t.id),
  );
  const staffingItems: GenStaffingItem[] = staffingNeeds
    .filter((n) => !doorTaskIds.has(n.taskTypeId))
    .map((n) => ({
      taskTypeId: n.taskTypeId,
      equipmentId: equipForTask.get(n.taskTypeId) ?? null,
      peopleNeeded: n.peopleNeeded,
    }));

  // Each active door becomes one unload position. Its task is a door-driven task
  // (needs_dock_door), chosen by matching the door's equipment to a door-task's
  // default equipment; if only one door-task exists, use it; otherwise leave the
  // task null (the board still shows the door + equipment).
  const doorTasks = inputs.tasks.filter((t) => t.needsDockDoor && t.active);
  const soleDoorTask = doorTasks.length === 1 ? doorTasks[0] : undefined;
  const doorTaskFor = (equipmentId: string | null): string | null => {
    if (equipmentId) {
      const byEquip = doorTasks.find(
        (t) => t.defaultEquipmentId === equipmentId,
      );
      if (byEquip) return byEquip.id;
    }
    return soleDoorTask?.id ?? null;
  };
  const genDoors = activeDoors.map((d) => ({
    dockDoorId: d.dockDoorId,
    equipmentId: d.equipmentId,
    taskTypeId: doorTaskFor(d.equipmentId),
  }));

  const result = generateAssignments({
    staffingItems,
    activeDoors: genDoors,
    availableAssociates,
    equipment: inputs.equipment.map((e) => ({
      id: e.id,
      certificationRequired: e.certificationRequired,
    })),
    rotation: {
      index: rotationIndex,
      planDate: plan.planDate,
      lookbackDays,
    },
  });

  const supabase = await createClient();
  // Regenerate is a reset of the planned board (special assignments are kept).
  const { error: delError } = await supabase
    .from('assignments')
    .delete()
    .eq('daily_plan_id', planId);
  if (delError) return dbFail();

  if (result.assignments.length > 0) {
    const rows = result.assignments.map((a) => ({
      daily_plan_id: planId,
      associate_id: a.associateId,
      task_type_id: a.taskTypeId,
      equipment_id: a.equipmentId,
      dock_door_id: a.dockDoorId,
      assignment_type: 'planned' as AssignmentType,
      status: 'assigned',
      is_primary_planned: true,
    }));
    const { error: insError } = await supabase.from('assignments').insert(rows);
    if (insError) return dbFail();
  }

  const { score } = scoreAssignments(
    result.assignments.map((a) => ({
      associateId: a.associateId,
      taskTypeId: a.taskTypeId,
    })),
    rotationIndex,
    plan.planDate,
    lookbackDays,
  );

  // Operational notifications from the freshly generated board.
  const shortfalls = computeStaffingShortfalls(
    inputs.tasks,
    staffingNeeds,
    activeDoors,
    result.assignments.map((a) => a.taskTypeId),
  );
  const assocName = new Map(
    inputs.associates.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]),
  );
  const taskNameById = new Map(inputs.tasks.map((t) => [t.id, t.name]));
  const conflicts: RotationConflict[] = [];
  for (const a of result.assignments) {
    if (
      recentConflictDate(
        rotationIndex,
        a.associateId,
        a.taskTypeId,
        plan.planDate,
        lookbackDays,
      )
    ) {
      conflicts.push({
        associateName: assocName.get(a.associateId) ?? 'Associate',
        taskName: a.taskTypeId
          ? (taskNameById.get(a.taskTypeId) ?? 'task')
          : 'task',
      });
    }
  }
  const label = await loadPlanLabel(plan);
  await applyNotifications(
    {
      facilityId: plan.facilityId,
      recipientUserId: plan.createdBy,
      dailyPlanId: plan.id,
    },
    [
      {
        key: `staffing:${planId}`,
        draft: buildStaffingWarning(label, shortfalls),
      },
      {
        key: `rotation:${planId}`,
        draft: buildRotationAlert(label, conflicts),
      },
    ],
  );

  revalidatePath(`/create-plan/${planId}`);
  return {
    ok: true,
    filled: result.assignments.length,
    open: result.openSlots.length,
    pool: result.pool.length,
    score,
  };
}

// --- Board edits ------------------------------------------------------------

export async function addAssignment(
  planId: string,
  input: z.input<typeof assignmentEditSchema>,
  assignmentType: AssignmentType = 'planned',
  lookbackDays: number = DEFAULT_LOOKBACK,
): Promise<WarnResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft')
    return fail('This plan is published and read-only.');
  const parsed = assignmentEditSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const equipmentId = nullable(parsed.data.equipmentId);
  const taskTypeId = nullable(parsed.data.taskTypeId);
  const warning = mergeWarnings(
    await certWarning(parsed.data.associateId, equipmentId),
    await rotationWarning(
      plan,
      parsed.data.associateId,
      taskTypeId,
      lookbackDays,
    ),
  );

  const supabase = await createClient();
  if (await hasActiveAssignment(supabase, planId, parsed.data.associateId)) {
    return fail(DUPLICATE_ASSIGNMENT_MESSAGE);
  }
  const { error } = await supabase.from('assignments').insert({
    daily_plan_id: planId,
    associate_id: parsed.data.associateId,
    task_type_id: taskTypeId,
    equipment_id: equipmentId,
    dock_door_id: nullable(parsed.data.dockDoorId),
    assignment_type: assignmentType,
    status: 'assigned',
    is_primary_planned: assignmentType === 'planned',
    notes: parsed.data.notes || null,
  });
  if (error)
    return isUniqueViolation(error)
      ? fail(DUPLICATE_ASSIGNMENT_MESSAGE)
      : dbFail();
  revalidatePath(`/create-plan/${planId}`);
  return warning ? { ok: true, warning } : { ok: true };
}

export async function updateAssignment(
  id: string,
  planId: string,
  input: z.input<typeof assignmentEditSchema>,
  lookbackDays: number = DEFAULT_LOOKBACK,
): Promise<WarnResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft')
    return fail('This plan is published and read-only.');
  const parsed = assignmentEditSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const equipmentId = nullable(parsed.data.equipmentId);
  const taskTypeId = nullable(parsed.data.taskTypeId);
  const warning = mergeWarnings(
    await certWarning(parsed.data.associateId, equipmentId),
    await rotationWarning(
      plan,
      parsed.data.associateId,
      taskTypeId,
      lookbackDays,
    ),
  );

  const supabase = await createClient();
  if (
    await hasActiveAssignment(supabase, planId, parsed.data.associateId, id)
  ) {
    return fail(DUPLICATE_ASSIGNMENT_MESSAGE);
  }
  const { error } = await supabase
    .from('assignments')
    .update({
      associate_id: parsed.data.associateId,
      task_type_id: taskTypeId,
      equipment_id: equipmentId,
      dock_door_id: nullable(parsed.data.dockDoorId),
      notes: parsed.data.notes || null,
    })
    .eq('id', id);
  if (error)
    return isUniqueViolation(error)
      ? fail(DUPLICATE_ASSIGNMENT_MESSAGE)
      : dbFail();
  revalidatePath(`/create-plan/${planId}`);
  return warning ? { ok: true, warning } : { ok: true };
}

export async function removeAssignment(
  id: string,
  planId: string,
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) return dbFail();
  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

/** Swap the task/equipment/door of two assignments (associates stay put). */
export async function switchAssignments(
  planId: string,
  aId: string,
  bId: string,
  lookbackDays: number = DEFAULT_LOOKBACK,
): Promise<WarnResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft')
    return fail('This plan is published and read-only.');
  if (aId === bId) return fail('Pick two different assignments.');

  const assignments = await listPlanAssignments(planId);
  const a = assignments.find((x) => x.id === aId);
  const b = assignments.find((x) => x.id === bId);
  if (!a || !b) return fail('Assignment not found.');

  // After the swap each associate takes the other's task + equipment — warn on
  // both certification and recent-repeat rotation.
  const warning = mergeWarnings(
    await certWarning(a.associateId, b.equipmentId),
    await certWarning(b.associateId, a.equipmentId),
    await rotationWarning(plan, a.associateId, b.taskTypeId, lookbackDays),
    await rotationWarning(plan, b.associateId, a.taskTypeId, lookbackDays),
  );

  const supabase = await createClient();
  const { error: e1 } = await supabase
    .from('assignments')
    .update({
      task_type_id: b.taskTypeId,
      equipment_id: b.equipmentId,
      dock_door_id: b.dockDoorId,
    })
    .eq('id', a.id);
  if (e1) return dbFail();
  const { error: e2 } = await supabase
    .from('assignments')
    .update({
      task_type_id: a.taskTypeId,
      equipment_id: a.equipmentId,
      dock_door_id: a.dockDoorId,
    })
    .eq('id', b.id);
  if (e2) return dbFail();

  revalidatePath(`/create-plan/${planId}`);
  return warning ? { ok: true, warning } : { ok: true };
}

// --- Publish ----------------------------------------------------------------

export async function publishPlan(planId: string): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft') return fail('This plan is already published.');

  const [assignments, specials, staffingNeeds, activeDoors, inputs] =
    await Promise.all([
      listPlanAssignments(planId),
      listSpecialAssignments(planId),
      listStaffingNeeds(planId),
      listPlanDockDoorRows(planId),
      getPlanInputs(plan.departmentId, plan.shiftKeyId),
    ]);

  if (assignments.length === 0 && specials.length === 0) {
    return fail('Add at least one assignment before publishing.');
  }

  const supabase = await createClient();

  // Freeze the official planned assignment history (PRD §4.1) — one row per
  // board assignment plus each special assignment's planned task.
  const historyRows = [
    ...assignments.map((a) => ({
      associate_id: a.associateId,
      task_type_id: a.taskTypeId,
      equipment_id: a.equipmentId,
      dock_door_id: a.dockDoorId,
    })),
    ...specials.map((s) => ({
      associate_id: s.associateId,
      task_type_id: s.taskTypeId,
      equipment_id: s.equipmentId,
      dock_door_id: s.dockDoorId,
    })),
  ].map((r) => ({
    ...r,
    daily_plan_id: planId,
    department_id: plan.departmentId,
    shift_key_id: plan.shiftKeyId,
    plan_date: plan.planDate,
  }));

  const { error: histError } = await supabase
    .from('planned_assignment_history')
    .insert(historyRows);
  if (histError) return dbFail();

  const { error: planError } = await supabase
    .from('daily_plans')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('status', 'draft');
  if (planError) return dbFail();

  await logAudit({
    actionType: 'publish_plan',
    entityType: 'daily_plan',
    entityId: planId,
    dailyPlanId: planId,
    newValue: { assignments: assignments.length, specials: specials.length },
  });

  // Notify: plan published; re-check staffing; the draft notice is now resolved.
  const label = await loadPlanLabel(plan);
  const ctx: EmitContext = {
    facilityId: plan.facilityId,
    recipientUserId: plan.createdBy,
    dailyPlanId: plan.id,
  };
  const shortfalls = computeStaffingShortfalls(
    inputs.tasks,
    staffingNeeds,
    activeDoors,
    assignments.map((a) => a.taskTypeId),
  );
  await emitNotifications(ctx, [buildPlanPublished(label)]);
  await applyNotifications(ctx, [
    {
      key: `staffing:${planId}`,
      draft: buildStaffingWarning(label, shortfalls),
    },
  ]);
  await clearNotificationsByDedupe(plan.facilityId, [`draft:${planId}`]);

  revalidatePath(`/create-plan/${planId}`);
  revalidatePath('/dashboard');
  return ok;
}
