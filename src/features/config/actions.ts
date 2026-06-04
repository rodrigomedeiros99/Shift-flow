'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, CONFIG_MANAGER_ROLES } from '@/features/auth/queries';
import type { ActionResult } from './types';
import {
  associateSchema,
  departmentSchema,
  dockDoorSchema,
  equipmentSchema,
  shiftKeySchema,
  taskSchema,
} from './schemas';

/**
 * Configuration mutations. Every action re-authorizes (manager role) and
 * re-validates input server-side before touching the database (§3: never trust
 * the client). RLS provides a second, independent gate. `revalidatePath`
 * refreshes the affected list after a successful write.
 */

const ok: ActionResult = { ok: true };
function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

/** Map common Postgres errors to user-friendly messages (§3 error handling). */
function dbError(error: { code?: string; message: string }): ActionResult {
  if (error.code === '23505') {
    return fail('A record with that value already exists.');
  }
  return fail('Could not save changes. Please try again.');
}

// --- Equipment --------------------------------------------------------------

export async function createEquipment(
  input: z.input<typeof equipmentSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase.from('equipment_types').insert({
    facility_id: profile.facilityId,
    name: parsed.data.name,
    certification_required: parsed.data.certificationRequired,
    active: parsed.data.active,
  });
  if (error) return dbError(error);
  revalidatePath('/equipment');
  return ok;
}

export async function updateEquipment(
  id: string,
  input: z.input<typeof equipmentSchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('equipment_types')
    .update({
      name: parsed.data.name,
      certification_required: parsed.data.certificationRequired,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/equipment');
  return ok;
}

export async function setEquipmentActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('equipment_types')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/equipment');
  return ok;
}

// --- Departments ------------------------------------------------------------

export async function createDepartment(
  input: z.input<typeof departmentSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase.from('departments').insert({
    facility_id: profile.facilityId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    active: parsed.data.active,
  });
  if (error) return dbError(error);
  revalidatePath('/settings/departments');
  return ok;
}

export async function updateDepartment(
  id: string,
  input: z.input<typeof departmentSchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('departments')
    .update({
      name: parsed.data.name,
      kind: parsed.data.kind,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/settings/departments');
  return ok;
}

export async function setDepartmentActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('departments')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/settings/departments');
  return ok;
}

// --- Tasks ------------------------------------------------------------------

export async function createTask(
  input: z.input<typeof taskSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase.from('task_types').insert({
    facility_id: profile.facilityId,
    department_id: parsed.data.departmentId,
    name: parsed.data.name,
    default_equipment_id: parsed.data.defaultEquipmentId,
    sort_order: parsed.data.sortOrder,
    active: parsed.data.active,
  });
  if (error) return dbError(error);
  revalidatePath('/tasks');
  return ok;
}

export async function updateTask(
  id: string,
  input: z.input<typeof taskSchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('task_types')
    .update({
      department_id: parsed.data.departmentId,
      name: parsed.data.name,
      default_equipment_id: parsed.data.defaultEquipmentId || null,
      sort_order: parsed.data.sortOrder,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/tasks');
  return ok;
}

export async function setTaskActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('task_types')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/tasks');
  return ok;
}

// --- Dock doors -------------------------------------------------------------

export async function createDockDoor(
  input: z.input<typeof dockDoorSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = dockDoorSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase.from('dock_doors').insert({
    facility_id: profile.facilityId,
    door_number: parsed.data.doorNumber,
    notes: parsed.data.notes,
    sort_order: parsed.data.sortOrder,
    active: parsed.data.active,
  });
  if (error) return dbError(error);
  revalidatePath('/dock-doors');
  return ok;
}

export async function updateDockDoor(
  id: string,
  input: z.input<typeof dockDoorSchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = dockDoorSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('dock_doors')
    .update({
      door_number: parsed.data.doorNumber,
      notes: parsed.data.notes || null,
      sort_order: parsed.data.sortOrder,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/dock-doors');
  return ok;
}

export async function setDockDoorActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('dock_doors')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/dock-doors');
  return ok;
}

// --- Shift keys -------------------------------------------------------------

export async function createShiftKey(
  input: z.input<typeof shiftKeySchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = shiftKeySchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase.from('shift_keys').insert({
    facility_id: profile.facilityId,
    name: parsed.data.name,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    days_of_week: parsed.data.daysOfWeek,
    active: parsed.data.active,
  });
  if (error) return dbError(error);
  revalidatePath('/settings/shift-keys');
  return ok;
}

export async function updateShiftKey(
  id: string,
  input: z.input<typeof shiftKeySchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = shiftKeySchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('shift_keys')
    .update({
      name: parsed.data.name,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      days_of_week: parsed.data.daysOfWeek,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/settings/shift-keys');
  return ok;
}

export async function setShiftKeyActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('shift_keys')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/settings/shift-keys');
  return ok;
}

// --- Associates -------------------------------------------------------------

async function syncCertifications(
  associateId: string,
  equipmentIds: string[],
): Promise<{ message: string } | null> {
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('associate_certifications')
    .delete()
    .eq('associate_id', associateId);
  if (delError) return delError;

  if (equipmentIds.length === 0) return null;

  const rows = equipmentIds.map((equipmentId) => ({
    associate_id: associateId,
    equipment_id: equipmentId,
    certified: true,
  }));
  const { error: insError } = await supabase
    .from('associate_certifications')
    .insert(rows);
  return insError ?? null;
}

export async function createAssociate(
  input: z.input<typeof associateSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = associateSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('associates')
    .insert({
      facility_id: profile.facilityId,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      employee_id: parsed.data.employeeId || null,
      department_id: parsed.data.departmentId,
      default_key_id: parsed.data.defaultKeyId,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .select('id')
    .single();
  if (error || !data) return dbError(error ?? { message: 'insert failed' });

  const certError = await syncCertifications(
    (data as { id: string }).id,
    parsed.data.certificationIds,
  );
  if (certError) return dbError(certError);

  revalidatePath('/associates');
  return ok;
}

export async function updateAssociate(
  id: string,
  input: z.input<typeof associateSchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = associateSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('associates')
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      employee_id: parsed.data.employeeId || null,
      department_id: parsed.data.departmentId,
      default_key_id: parsed.data.defaultKeyId,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);

  const certError = await syncCertifications(id, parsed.data.certificationIds);
  if (certError) return dbError(certError);

  revalidatePath('/associates');
  return ok;
}

export async function setAssociateActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('associates')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/associates');
  return ok;
}
