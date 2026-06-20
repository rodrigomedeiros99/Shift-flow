import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  DEPARTMENT_KINDS,
  type DepartmentKind,
} from '@/lib/constants/departments';
import type {
  Associate,
  Department,
  DockDoor,
  EquipmentType,
  ShiftKey,
  TaskType,
} from '@/types/domain';

/**
 * Read access for configuration entities. RLS scopes every result to the
 * caller's facility, so these queries don't filter by facility themselves.
 * Errors are thrown so the route's error boundary renders (§ error states).
 */

async function db() {
  return createClient();
}

function fail(entity: string, message: string): never {
  throw new Error(`Failed to load ${entity}: ${message}`);
}

/** Narrow a stored department kind, defaulting unknown values to 'other'. */
function toDepartmentKind(value: string): DepartmentKind {
  return (DEPARTMENT_KINDS as readonly string[]).includes(value)
    ? (value as DepartmentKind)
    : 'other';
}

interface EquipmentRow {
  id: string;
  facility_id: string;
  name: string;
  certification_required: boolean;
  active: boolean;
}

export async function listEquipment(): Promise<EquipmentType[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('equipment_types')
    .select('id, facility_id, name, certification_required, active')
    .order('name');
  if (error) fail('equipment', error.message);
  return ((data as EquipmentRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    name: r.name,
    certificationRequired: r.certification_required,
    active: r.active,
  }));
}

interface DepartmentRow {
  id: string;
  facility_id: string;
  name: string;
  kind: string;
  active: boolean;
  created_at: string;
}

export async function listDepartments(): Promise<Department[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('departments')
    .select('id, facility_id, name, kind, active, created_at')
    .order('name');
  if (error) fail('departments', error.message);
  return ((data as DepartmentRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    name: r.name,
    kind: toDepartmentKind(r.kind),
    active: r.active,
    createdAt: r.created_at,
  }));
}

interface ShiftKeyRow {
  id: string;
  facility_id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: string;
  productive_hours: number | string | null;
  active: boolean;
}

export async function listShiftKeys(): Promise<ShiftKey[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('shift_keys')
    .select(
      'id, facility_id, name, start_time, end_time, days_of_week, productive_hours, active',
    )
    .order('name');
  if (error) fail('shift keys', error.message);
  return ((data as ShiftKeyRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    name: r.name,
    startTime: r.start_time,
    endTime: r.end_time,
    daysOfWeek: r.days_of_week,
    productiveHours:
      r.productive_hours === null ? null : Number(r.productive_hours),
    active: r.active,
  }));
}

interface TaskRow {
  id: string;
  facility_id: string;
  department_id: string;
  name: string;
  default_equipment_id: string | null;
  needs_dock_door: boolean;
  uses_uph: boolean;
  avg_units_per_hour: number | string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export async function listTasks(): Promise<TaskType[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('task_types')
    .select(
      'id, facility_id, department_id, name, default_equipment_id, needs_dock_door, uses_uph, avg_units_per_hour, active, sort_order, created_at',
    )
    .order('sort_order')
    .order('name');
  if (error) fail('tasks', error.message);
  return ((data as TaskRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    departmentId: r.department_id,
    name: r.name,
    defaultEquipmentId: r.default_equipment_id,
    needsDockDoor: r.needs_dock_door,
    usesUph: r.uses_uph,
    avgUnitsPerHour:
      r.avg_units_per_hour === null ? null : Number(r.avg_units_per_hour),
    active: r.active,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}

interface DockDoorRow {
  id: string;
  facility_id: string;
  door_number: string;
  active: boolean;
  notes: string | null;
  sort_order: number;
}

export async function listDockDoors(): Promise<DockDoor[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('dock_doors')
    .select('id, facility_id, door_number, active, notes, sort_order')
    .order('sort_order')
    .order('door_number');
  if (error) fail('dock doors', error.message);
  return ((data as DockDoorRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    doorNumber: r.door_number,
    active: r.active,
    notes: r.notes,
    sortOrder: r.sort_order,
  }));
}

interface AssociateRow {
  id: string;
  facility_id: string;
  first_name: string;
  last_name: string;
  employee_id: string | null;
  department_id: string;
  default_key_id: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export async function listAssociates(): Promise<Associate[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('associates')
    .select(
      'id, facility_id, first_name, last_name, employee_id, department_id, default_key_id, active, notes, created_at',
    )
    .order('last_name')
    .order('first_name');
  if (error) fail('associates', error.message);
  return ((data as AssociateRow[] | null) ?? []).map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    firstName: r.first_name,
    lastName: r.last_name,
    employeeId: r.employee_id,
    departmentId: r.department_id,
    defaultKeyId: r.default_key_id,
    active: r.active,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

interface CertRow {
  associate_id: string;
  equipment_id: string;
  certified: boolean;
}

/** Map of associateId → certified equipmentIds, for table badges and edit forms. */
export async function listCertificationsByAssociate(): Promise<
  Record<string, string[]>
> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('associate_certifications')
    .select('associate_id, equipment_id, certified');
  if (error) fail('certifications', error.message);
  const map: Record<string, string[]> = {};
  for (const row of (data as CertRow[] | null) ?? []) {
    if (!row.certified) continue;
    (map[row.associate_id] ??= []).push(row.equipment_id);
  }
  return map;
}
