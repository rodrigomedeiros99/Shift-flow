'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { listTemplateItems } from '@/features/templates/queries';
import {
  findActivePlan,
  getPlan,
  getPlanInputs,
  getRotationRecords,
  listCallOffs,
  listPlanAssignments,
  listPlanDockDoors,
  listSpecialAssignments,
} from './queries';
import { generateAssignments, type GenTemplateItem } from './generate';
import {
  buildRotationIndex,
  recentConflictDate,
  scoreAssignments,
} from './rotation';
import { logAudit } from '@/features/audit/log';
import type { DailyPlan } from '@/types/domain';
import {
  activeDoorsSchema,
  assignmentEditSchema,
  overtimeEntrySchema,
  planSetupSchema,
  specialAssignmentSchema,
  trainingPairSchema,
} from './schemas';
import type {
  ActionResult,
  CreateDraftResult,
  GenerateResult,
  WarnResult,
} from './types';
import type {
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
  revalidatePath('/dashboard');
  return { ok: true, id: newId };
}

// --- Morning wizard ---------------------------------------------------------

export async function saveCallOffs(
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
      created_by: profile.id,
    }));
    const { error: insError } = await supabase.from('call_offs').insert(rows);
    if (insError) return dbFail();
  }

  revalidatePath(`/create-plan/${planId}`);
  return ok;
}

/** Replace the plan's active dock doors (inbound Step 4). */
export async function saveActiveDoors(
  planId: string,
  doorIds: string[],
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const guard = await requireDraft(planId);
  if (!guard.ok) return guard;
  const parsed = activeDoorsSchema.safeParse({ doorIds });
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('plan_dock_doors')
    .delete()
    .eq('daily_plan_id', planId);
  if (delError) return dbFail();

  if (parsed.data.doorIds.length > 0) {
    const rows = parsed.data.doorIds.map((dockDoorId) => ({
      daily_plan_id: planId,
      dock_door_id: dockDoorId,
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

// --- Auto-generate ----------------------------------------------------------

export type GenerateSource =
  | { type: 'template'; templateId: string }
  | { type: 'blank' };

export async function autoGeneratePlan(
  planId: string,
  source: GenerateSource,
  lookbackDays: number = DEFAULT_LOOKBACK,
): Promise<GenerateResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status !== 'draft')
    return fail('This plan is published and read-only.');

  const [inputs, callOffs, specials, activeDoorIds, rotationRecords] =
    await Promise.all([
      getPlanInputs(plan.departmentId, plan.shiftKeyId),
      listCallOffs(planId),
      listSpecialAssignments(planId),
      listPlanDockDoors(planId),
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

  let templateItems: GenTemplateItem[] = [];
  if (source.type === 'template') {
    const items = await listTemplateItems(source.templateId);
    templateItems = items.map((i) => ({
      taskTypeId: i.taskTypeId,
      dockDoorId: i.dockDoorId,
      defaultEquipmentId: i.defaultEquipmentId,
      peopleNeeded: i.peopleNeeded,
      sortOrder: i.sortOrder,
      perActiveDoor: i.perActiveDoor,
    }));
  }

  const result = generateAssignments({
    templateItems,
    availableAssociates,
    equipment: inputs.equipment.map((e) => ({
      id: e.id,
      certificationRequired: e.certificationRequired,
    })),
    activeDoorIds,
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
  if (error) return dbFail();
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
  if (error) return dbFail();
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

  const [assignments, specials] = await Promise.all([
    listPlanAssignments(planId),
    listSpecialAssignments(planId),
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
  revalidatePath(`/create-plan/${planId}`);
  revalidatePath('/dashboard');
  return ok;
}
