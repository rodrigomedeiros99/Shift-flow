import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { PlanTemplate, TemplateItem } from '@/types/domain';

/**
 * Read access for planning templates (Phase 4). RLS scopes every result to the
 * caller's facility, so these queries don't filter by facility themselves.
 * Errors are thrown so the route's error boundary renders (§ error states).
 */

async function db() {
  return createClient();
}

function fail(entity: string, message: string): never {
  throw new Error(`Failed to load ${entity}: ${message}`);
}

interface TemplateRow {
  id: string;
  facility_id: string;
  department_id: string;
  shift_key_id: string;
  name: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

function toTemplate(r: TemplateRow): PlanTemplate {
  return {
    id: r.id,
    facilityId: r.facility_id,
    departmentId: r.department_id,
    shiftKeyId: r.shift_key_id,
    name: r.name,
    active: r.active,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

const TEMPLATE_COLUMNS =
  'id, facility_id, department_id, shift_key_id, name, active, created_by, created_at';

export async function listTemplates(): Promise<PlanTemplate[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('plan_templates')
    .select(TEMPLATE_COLUMNS)
    .order('name');
  if (error) fail('templates', error.message);
  return ((data as TemplateRow[] | null) ?? []).map(toTemplate);
}

/** A single template by id, or null if not found / not in the caller's facility. */
export async function getTemplate(id: string): Promise<PlanTemplate | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('plan_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) fail('template', error.message);
  return data ? toTemplate(data as TemplateRow) : null;
}

interface TemplateItemRow {
  id: string;
  template_id: string;
  task_type_id: string | null;
  dock_door_id: string | null;
  default_equipment_id: string | null;
  people_needed: number;
  sort_order: number;
  per_active_door: boolean;
  notes: string | null;
}

export async function listTemplateItems(
  templateId: string,
): Promise<TemplateItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('template_items')
    .select(
      'id, template_id, task_type_id, dock_door_id, default_equipment_id, people_needed, sort_order, per_active_door, notes',
    )
    .eq('template_id', templateId)
    .order('sort_order')
    .order('id');
  if (error) fail('template items', error.message);
  return ((data as TemplateItemRow[] | null) ?? []).map((r) => ({
    id: r.id,
    templateId: r.template_id,
    taskTypeId: r.task_type_id,
    dockDoorId: r.dock_door_id,
    defaultEquipmentId: r.default_equipment_id,
    peopleNeeded: r.people_needed,
    sortOrder: r.sort_order,
    perActiveDoor: r.per_active_door,
    notes: r.notes,
  }));
}
