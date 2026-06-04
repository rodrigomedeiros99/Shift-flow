'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, TEMPLATE_MANAGER_ROLES } from '@/features/auth/queries';
import type { ActionResult, CreateResult } from './types';
import { templateSchema, templateItemSchema } from './schemas';

/**
 * Template mutations (Phase 4). Every action re-authorizes (planner role) and
 * re-validates input server-side before touching the database (§3: never trust
 * the client). RLS provides a second, independent gate. `revalidatePath`
 * refreshes the affected list/editor after a successful write.
 */

const ok: ActionResult = { ok: true };
// Narrow failure type so it's assignable to both ActionResult and CreateResult.
function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

/** Map common Postgres errors to user-friendly messages (§3 error handling). */
function dbError(error: { code?: string; message: string }): {
  ok: false;
  error: string;
} {
  if (error.code === '23505') {
    return fail('A template with that name already exists for this key.');
  }
  return fail('Could not save changes. Please try again.');
}

/** '' (no selection) → null for nullable foreign keys. */
function nullable(value: string): string | null {
  return value === '' ? null : value;
}

// --- Template header --------------------------------------------------------

export async function createTemplate(
  input: z.input<typeof templateSchema>,
): Promise<CreateResult> {
  const profile = await requireRole(TEMPLATE_MANAGER_ROLES);
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plan_templates')
    .insert({
      facility_id: profile.facilityId,
      department_id: parsed.data.departmentId,
      shift_key_id: parsed.data.shiftKeyId,
      name: parsed.data.name,
      active: parsed.data.active,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !data) return dbError(error ?? { message: 'insert failed' });

  revalidatePath('/templates');
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateTemplate(
  id: string,
  input: z.input<typeof templateSchema>,
): Promise<ActionResult> {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('plan_templates')
    .update({
      department_id: parsed.data.departmentId,
      shift_key_id: parsed.data.shiftKeyId,
      name: parsed.data.name,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/templates');
  revalidatePath(`/templates/${id}`);
  return ok;
}

export async function setTemplateActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from('plan_templates')
    .update({ active })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/templates');
  revalidatePath(`/templates/${id}`);
  return ok;
}

interface TemplateHeaderRow {
  facility_id: string;
  department_id: string;
  shift_key_id: string;
  name: string;
  active: boolean;
}

interface TemplateItemCopyRow {
  task_type_id: string | null;
  dock_door_id: string | null;
  default_equipment_id: string | null;
  people_needed: number;
  sort_order: number;
  notes: string | null;
}

/** Copy a template and all its items into a new "(copy)" template. */
export async function duplicateTemplate(id: string): Promise<CreateResult> {
  const profile = await requireRole(TEMPLATE_MANAGER_ROLES);
  const supabase = await createClient();

  const { data: source, error: srcError } = await supabase
    .from('plan_templates')
    .select('facility_id, department_id, shift_key_id, name, active')
    .eq('id', id)
    .single();
  if (srcError || !source) return fail('Template not found.');
  const src = source as TemplateHeaderRow;

  const { data: created, error: insError } = await supabase
    .from('plan_templates')
    .insert({
      facility_id: src.facility_id,
      department_id: src.department_id,
      shift_key_id: src.shift_key_id,
      name: `${src.name} (copy)`,
      active: src.active,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (insError || !created)
    return dbError(insError ?? { message: 'insert failed' });
  const newId = (created as { id: string }).id;

  const { data: items, error: itemsError } = await supabase
    .from('template_items')
    .select(
      'task_type_id, dock_door_id, default_equipment_id, people_needed, sort_order, notes',
    )
    .eq('template_id', id);
  if (itemsError) return dbError(itemsError);

  const rows = (items as TemplateItemCopyRow[] | null) ?? [];
  if (rows.length > 0) {
    const { error: copyError } = await supabase
      .from('template_items')
      .insert(rows.map((r) => ({ ...r, template_id: newId })));
    if (copyError) return dbError(copyError);
  }

  revalidatePath('/templates');
  return { ok: true, id: newId };
}

// --- Template items ---------------------------------------------------------

export async function createTemplateItem(
  templateId: string,
  input: z.input<typeof templateItemSchema>,
): Promise<ActionResult> {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const parsed = templateItemSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();

  // Append at the end: distinct sort_order keeps the ▲▼ swap reliable.
  const { data: last } = await supabase
    .from('template_items')
    .select('sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort =
    ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from('template_items').insert({
    template_id: templateId,
    task_type_id: parsed.data.taskTypeId,
    dock_door_id: nullable(parsed.data.dockDoorId),
    default_equipment_id: nullable(parsed.data.defaultEquipmentId),
    people_needed: parsed.data.peopleNeeded,
    sort_order: nextSort,
    per_active_door: parsed.data.perActiveDoor,
    notes: parsed.data.notes || null,
  });
  if (error) return dbError(error);
  revalidatePath(`/templates/${templateId}`);
  return ok;
}

export async function updateTemplateItem(
  id: string,
  templateId: string,
  input: z.input<typeof templateItemSchema>,
): Promise<ActionResult> {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const parsed = templateItemSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('template_items')
    .update({
      task_type_id: parsed.data.taskTypeId,
      dock_door_id: nullable(parsed.data.dockDoorId),
      default_equipment_id: nullable(parsed.data.defaultEquipmentId),
      people_needed: parsed.data.peopleNeeded,
      per_active_door: parsed.data.perActiveDoor,
      notes: parsed.data.notes || null,
    })
    .eq('id', id);
  if (error) return dbError(error);
  revalidatePath(`/templates/${templateId}`);
  return ok;
}

export async function deleteTemplateItem(
  id: string,
  templateId: string,
): Promise<ActionResult> {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from('template_items').delete().eq('id', id);
  if (error) return dbError(error);
  revalidatePath(`/templates/${templateId}`);
  return ok;
}

interface NeighborRow {
  id: string;
  sort_order: number;
}

/**
 * Move an item up/down by swapping its `sort_order` with the adjacent item.
 * No-op (still ok) when already at the boundary.
 */
export async function moveTemplateItem(
  id: string,
  templateId: string,
  direction: 'up' | 'down',
): Promise<ActionResult> {
  await requireRole(TEMPLATE_MANAGER_ROLES);
  const supabase = await createClient();

  const { data: current, error: curError } = await supabase
    .from('template_items')
    .select('id, sort_order')
    .eq('id', id)
    .single();
  if (curError || !current) return fail('Item not found.');
  const cur = current as NeighborRow;

  // The nearest neighbor in the move direction, by sort_order then id (the
  // same ordering the list uses), so swaps are stable even on tied sort_order.
  const query = supabase
    .from('template_items')
    .select('id, sort_order')
    .eq('template_id', templateId)
    .limit(1);

  const { data: neighbor, error: neiError } =
    direction === 'up'
      ? await query
          .lt('sort_order', cur.sort_order)
          .order('sort_order', { ascending: false })
          .maybeSingle()
      : await query
          .gt('sort_order', cur.sort_order)
          .order('sort_order', { ascending: true })
          .maybeSingle();
  if (neiError) return dbError(neiError);
  if (!neighbor) return ok; // already at the boundary
  const nei = neighbor as NeighborRow;

  const { error: e1 } = await supabase
    .from('template_items')
    .update({ sort_order: nei.sort_order })
    .eq('id', cur.id);
  if (e1) return dbError(e1);
  const { error: e2 } = await supabase
    .from('template_items')
    .update({ sort_order: cur.sort_order })
    .eq('id', nei.id);
  if (e2) return dbError(e2);

  revalidatePath(`/templates/${templateId}`);
  return ok;
}
