'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { getPlan } from '@/features/planning/queries';
import { moveSchema, poolAssignSchema } from './schemas';
import { logAudit } from '@/features/audit/log';
import type { ActionResult, WarnResult } from '@/features/planning/types';
import type {
  ActivityAction,
  AssignmentType,
} from '@/lib/constants/assignments';
import type { DailyPlan } from '@/types/domain';

/**
 * Live Operations mutations (Steps 9–10). Every action re-authorizes (planner
 * role), guards that the plan is still PUBLISHED (not draft, not closed), and
 * records the change in `activity_history`. The published `planned_assignment_history`
 * is never touched — only the live `assignments` rows change (PRD §4.1).
 */

const ok: ActionResult = { ok: true };
function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}
function dbFail(): { ok: false; error: string } {
  return fail('Could not save changes. Please try again.');
}
function nullable(value: string): string | null {
  return value === '' ? null : value;
}

/** Live status values a leader can set directly (Complete has its own action). */
type LiveStatus = 'active' | 'break' | 'lunch' | 'available';

/** Guard: the plan exists and is open for live operations (published). */
async function requirePublished(
  planId: string,
): Promise<DailyPlan | { ok: false; error: string }> {
  const plan = await getPlan(planId);
  if (!plan) return fail('Plan not found.');
  if (plan.status === 'draft')
    return fail('Publish the plan before running it live.');
  if (plan.status !== 'published')
    return fail('This shift is closed and read-only.');
  return plan;
}

interface AssignmentSnapshot {
  associateId: string;
  taskTypeId: string | null;
  equipmentId: string | null;
  dockDoorId: string | null;
  startedAt: string | null;
}

async function getAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<AssignmentSnapshot | null> {
  const { data } = await supabase
    .from('assignments')
    .select(
      'associate_id, task_type_id, equipment_id, dock_door_id, started_at',
    )
    .eq('id', id)
    .maybeSingle();
  const r = data as {
    associate_id: string;
    task_type_id: string | null;
    equipment_id: string | null;
    dock_door_id: string | null;
    started_at: string | null;
  } | null;
  return r
    ? {
        associateId: r.associate_id,
        taskTypeId: r.task_type_id,
        equipmentId: r.equipment_id,
        dockDoorId: r.dock_door_id,
        startedAt: r.started_at,
      }
    : null;
}

interface ActivitySlot {
  taskTypeId: string | null;
  equipmentId: string | null;
  dockDoorId: string | null;
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    planId: string;
    associateId: string;
    action: ActivityAction;
    from?: ActivitySlot | null;
    to?: ActivitySlot | null;
    reason?: string | null;
    changedBy: string;
  },
): Promise<void> {
  await supabase.from('activity_history').insert({
    daily_plan_id: params.planId,
    associate_id: params.associateId,
    action_type: params.action,
    from_task_type_id: params.from?.taskTypeId ?? null,
    to_task_type_id: params.to?.taskTypeId ?? null,
    from_equipment_id: params.from?.equipmentId ?? null,
    to_equipment_id: params.to?.equipmentId ?? null,
    from_dock_door_id: params.from?.dockDoorId ?? null,
    to_dock_door_id: params.to?.dockDoorId ?? null,
    reason: params.reason ?? null,
    changed_by: params.changedBy,
  });
}

/** Non-blocking certification warning (PRD §5/§6: validate, but leader decides). */
async function certWarning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  associateId: string,
  equipmentId: string | null,
): Promise<string | null> {
  if (!equipmentId) return null;
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

function revalidate(planId: string): void {
  revalidatePath(`/live-plan/${planId}`);
  revalidatePath('/tv');
}

// --- Move (reassign what an associate is doing) -----------------------------

export async function moveAssignment(
  id: string,
  planId: string,
  input: z.input<typeof moveSchema>,
): Promise<WarnResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const current = await getAssignment(supabase, id);
  if (!current) return fail('Assignment not found.');

  const to: ActivitySlot = {
    taskTypeId: nullable(parsed.data.taskTypeId),
    equipmentId: nullable(parsed.data.equipmentId),
    dockDoorId: nullable(parsed.data.dockDoorId),
  };
  const warning = await certWarning(
    supabase,
    current.associateId,
    to.equipmentId,
  );

  const { error } = await supabase
    .from('assignments')
    .update({
      task_type_id: to.taskTypeId,
      equipment_id: to.equipmentId,
      dock_door_id: to.dockDoorId,
      notes: parsed.data.notes || null,
    })
    .eq('id', id);
  if (error) return dbFail();

  await logActivity(supabase, {
    planId,
    associateId: current.associateId,
    action: 'moved',
    from: current,
    to,
    changedBy: profile.id,
  });
  await logAudit({
    actionType: 'moved_associate',
    entityType: 'assignment',
    entityId: id,
    dailyPlanId: planId,
  });
  revalidate(planId);
  return warning ? { ok: true, warning } : { ok: true };
}

// --- Switch two associates --------------------------------------------------

export async function switchLive(
  planId: string,
  aId: string,
  bId: string,
): Promise<WarnResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;
  if (aId === bId) return fail('Pick two different assignments.');

  const supabase = await createClient();
  const a = await getAssignment(supabase, aId);
  const b = await getAssignment(supabase, bId);
  if (!a || !b) return fail('Assignment not found.');

  const warnings: string[] = [];
  const wa = await certWarning(supabase, a.associateId, b.equipmentId);
  const wb = await certWarning(supabase, b.associateId, a.equipmentId);
  if (wa) warnings.push(wa);
  if (wb) warnings.push(wb);

  const { error: e1 } = await supabase
    .from('assignments')
    .update({
      task_type_id: b.taskTypeId,
      equipment_id: b.equipmentId,
      dock_door_id: b.dockDoorId,
    })
    .eq('id', aId);
  if (e1) return dbFail();
  const { error: e2 } = await supabase
    .from('assignments')
    .update({
      task_type_id: a.taskTypeId,
      equipment_id: a.equipmentId,
      dock_door_id: a.dockDoorId,
    })
    .eq('id', bId);
  if (e2) return dbFail();

  await logActivity(supabase, {
    planId,
    associateId: a.associateId,
    action: 'switched',
    from: a,
    to: b,
    changedBy: profile.id,
  });
  await logActivity(supabase, {
    planId,
    associateId: b.associateId,
    action: 'switched',
    from: b,
    to: a,
    changedBy: profile.id,
  });
  await logAudit({
    actionType: 'switched_assignment',
    entityType: 'assignment',
    entityId: aId,
    dailyPlanId: planId,
    newValue: { a: aId, b: bId },
  });
  revalidate(planId);
  return warnings.length > 0 ? { ok: true, warning: warnings.join(' ') } : ok;
}

// --- Add / assign from pool (incl. housekeeping & support) ------------------

export async function addLiveAssignment(
  planId: string,
  input: z.input<typeof poolAssignSchema>,
  assignmentType: AssignmentType = 'support',
): Promise<WarnResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;
  const parsed = poolAssignSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const to: ActivitySlot = {
    taskTypeId: nullable(parsed.data.taskTypeId),
    equipmentId: nullable(parsed.data.equipmentId),
    dockDoorId: nullable(parsed.data.dockDoorId),
  };
  const warning = await certWarning(
    supabase,
    parsed.data.associateId,
    to.equipmentId,
  );

  const { error } = await supabase.from('assignments').insert({
    daily_plan_id: planId,
    associate_id: parsed.data.associateId,
    task_type_id: to.taskTypeId,
    equipment_id: to.equipmentId,
    dock_door_id: to.dockDoorId,
    assignment_type: assignmentType,
    status: 'assigned',
    is_primary_planned: false,
    notes: parsed.data.notes || null,
  });
  if (error) return dbFail();

  // A late arrival assigned in Live Plan is no longer absent — clear any
  // Not Available marker for this plan so they don't show in both lists.
  await supabase
    .from('call_offs')
    .delete()
    .eq('daily_plan_id', planId)
    .eq('associate_id', parsed.data.associateId);

  await logActivity(supabase, {
    planId,
    associateId: parsed.data.associateId,
    action: 'assigned',
    to,
    changedBy: profile.id,
  });
  revalidate(planId);
  return warning ? { ok: true, warning } : { ok: true };
}

// --- Not Available (live) ---------------------------------------------------

/**
 * Remove an associate's Not Available marker for this plan (e.g. they arrived
 * late). Published-safe — unlike the draft-only `saveNotAvailable`. They return
 * to the normal available pool. No assignment is created here.
 */
export async function removeFromNotAvailable(
  planId: string,
  associateId: string,
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;
  if (!z.string().uuid().safeParse(associateId).success) {
    return fail('Please try again.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('call_offs')
    .delete()
    .eq('daily_plan_id', planId)
    .eq('associate_id', associateId);
  if (error) return dbFail();

  revalidate(planId);
  return ok;
}

// --- Remove -----------------------------------------------------------------

export async function removeLiveAssignment(
  id: string,
  planId: string,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;

  const supabase = await createClient();
  const current = await getAssignment(supabase, id);
  if (!current) return fail('Assignment not found.');

  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) return dbFail();

  await logActivity(supabase, {
    planId,
    associateId: current.associateId,
    action: 'removed',
    from: current,
    changedBy: profile.id,
  });
  revalidate(planId);
  return ok;
}

// --- Status (active / break / lunch / available) ----------------------------

export async function setAssignmentStatus(
  id: string,
  planId: string,
  status: LiveStatus,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;

  const supabase = await createClient();
  const current = await getAssignment(supabase, id);
  if (!current) return fail('Assignment not found.');

  const update: Record<string, unknown> = { status };
  // First time someone goes active, stamp the start of work.
  if (status === 'active' && !current.startedAt) {
    update.started_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('assignments')
    .update(update)
    .eq('id', id);
  if (error) return dbFail();

  await logActivity(supabase, {
    planId,
    associateId: current.associateId,
    action: 'status_changed',
    reason: status,
    changedBy: profile.id,
  });
  revalidate(planId);
  return ok;
}

// --- Complete (trailer / assignment done → back to Available Pool) ----------

export async function completeAssignment(
  id: string,
  planId: string,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;

  const supabase = await createClient();
  const current = await getAssignment(supabase, id);
  if (!current) return fail('Assignment not found.');

  const { error } = await supabase
    .from('assignments')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return dbFail();

  await logActivity(supabase, {
    planId,
    associateId: current.associateId,
    action: 'completed',
    from: current,
    changedBy: profile.id,
  });
  revalidate(planId);
  return ok;
}

// --- Shift close ------------------------------------------------------------

export async function closeShift(planId: string): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  const plan = await requirePublished(planId);
  if ('ok' in plan) return plan;

  const supabase = await createClient();
  const { error } = await supabase
    .from('daily_plans')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('status', 'published');
  if (error) return dbFail();
  await logAudit({
    actionType: 'close_shift',
    entityType: 'daily_plan',
    entityId: planId,
    dailyPlanId: planId,
  });
  revalidatePath(`/live-plan/${planId}`);
  revalidatePath('/dashboard');
  revalidatePath('/tv');
  return ok;
}
