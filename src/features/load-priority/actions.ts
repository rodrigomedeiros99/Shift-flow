'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  requireRole,
  CONFIG_MANAGER_ROLES,
  PLANNER_ROLES,
} from '@/features/auth/queries';
import type { ActionResult } from '@/features/planning/types';
import { logAudit } from '@/features/audit/log';
import { weekdayOf } from './zones';
import {
  boardCreateSchema,
  entrySchema,
  weeklyRowSchema,
  zoneRangeSchema,
} from './schemas';

/**
 * Load Priority mutations. The Weekly Master Schedule + boards + entries are
 * planner-gated (auth_can_plan); zone ranges are manager-gated (auth_is_manager).
 * Every action re-authorizes and re-validates server-side; RLS is the second gate.
 */

type IdResult = { ok: true; id: string } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}
function dbFail(): { ok: false; error: string } {
  return fail('Could not save changes. Please try again.');
}
function nullable(value: string | undefined): string | null {
  return value && value !== '' ? value : null;
}
function revalidate(): void {
  revalidatePath('/load-priority');
  revalidatePath('/load-priority-tv');
}

// --- Weekly master schedule (planner) ---------------------------------------

export async function createWeeklyRow(
  input: z.input<typeof weeklyRowSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const parsed = weeklyRowSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_weekly_schedules')
    .insert({
      facility_id: profile.facilityId,
      weekday: parsed.data.weekday,
      door_number: parsed.data.doorNumber,
      lane_number: nullable(parsed.data.laneNumber),
      carrier_label: nullable(parsed.data.carrierLabel),
      close_time: parsed.data.closeTime,
      zone: parsed.data.zone,
      active: parsed.data.active,
      notes: nullable(parsed.data.notes),
      created_by: profile.id,
      updated_by: profile.id,
    });
  if (error) return dbFail();
  revalidatePath('/load-priority/schedule');
  revalidatePath('/load-priority');
  return ok;
}

export async function updateWeeklyRow(
  id: string,
  input: z.input<typeof weeklyRowSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const parsed = weeklyRowSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_weekly_schedules')
    .update({
      weekday: parsed.data.weekday,
      door_number: parsed.data.doorNumber,
      lane_number: nullable(parsed.data.laneNumber),
      carrier_label: nullable(parsed.data.carrierLabel),
      close_time: parsed.data.closeTime,
      zone: parsed.data.zone,
      active: parsed.data.active,
      notes: nullable(parsed.data.notes),
      updated_by: profile.id,
    })
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath('/load-priority/schedule');
  return ok;
}

export async function setWeeklyRowActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(id).success)
    return fail('Please try again.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_weekly_schedules')
    .update({ active })
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath('/load-priority/schedule');
  return ok;
}

export async function deleteWeeklyRow(id: string): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(id).success)
    return fail('Please try again.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_weekly_schedules')
    .delete()
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath('/load-priority/schedule');
  return ok;
}

/**
 * Copy every active row from one weekday onto another. Rows are appended (doors
 * may repeat), so the target keeps its own rows plus copies of the source's.
 */
export async function copyDaySchedule(
  fromWeekday: number,
  toWeekday: number,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  if (fromWeekday === toWeekday) return fail('Pick two different days.');
  if (![fromWeekday, toWeekday].every((d) => d >= 0 && d <= 6))
    return fail('Please try again.');

  const supabase = await createClient();
  const { data } = await supabase
    .from('load_priority_weekly_schedules')
    .select(
      'door_number, lane_number, carrier_label, close_time, zone, notes, sort_order',
    )
    .eq('facility_id', profile.facilityId)
    .eq('weekday', fromWeekday)
    .eq('active', true);
  const source =
    (data as
      | {
          door_number: string;
          lane_number: string | null;
          carrier_label: string | null;
          close_time: string;
          zone: number;
          notes: string | null;
          sort_order: number;
        }[]
      | null) ?? [];
  if (source.length === 0) return fail('That day has no active rows to copy.');

  const { error } = await supabase
    .from('load_priority_weekly_schedules')
    .insert(
      source.map((r) => ({
        facility_id: profile.facilityId,
        weekday: toWeekday,
        door_number: r.door_number,
        lane_number: r.lane_number,
        carrier_label: r.carrier_label,
        close_time: r.close_time,
        zone: r.zone,
        notes: r.notes,
        sort_order: r.sort_order,
        active: true,
        created_by: profile.id,
        updated_by: profile.id,
      })),
    );
  if (error) return dbFail();
  revalidatePath('/load-priority/schedule');
  return ok;
}

// --- Zone ranges (manager) --------------------------------------------------

export async function createZone(
  input: z.input<typeof zoneRangeSchema>,
): Promise<ActionResult> {
  const profile = await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = zoneRangeSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');
  if (parsed.data.doorHigh < parsed.data.doorLow)
    return fail('High door must be ≥ low door.');

  const supabase = await createClient();
  const { error } = await supabase.from('load_priority_zones').insert({
    facility_id: profile.facilityId,
    zone: parsed.data.zone,
    door_low: parsed.data.doorLow,
    door_high: parsed.data.doorHigh,
    active: parsed.data.active,
  });
  if (error) return dbFail();
  revalidatePath('/settings/load-priority');
  return ok;
}

export async function updateZone(
  id: string,
  input: z.input<typeof zoneRangeSchema>,
): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  const parsed = zoneRangeSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');
  if (parsed.data.doorHigh < parsed.data.doorLow)
    return fail('High door must be ≥ low door.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_zones')
    .update({
      zone: parsed.data.zone,
      door_low: parsed.data.doorLow,
      door_high: parsed.data.doorHigh,
      active: parsed.data.active,
    })
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath('/settings/load-priority');
  return ok;
}

export async function deleteZone(id: string): Promise<ActionResult> {
  await requireRole(CONFIG_MANAGER_ROLES);
  if (!z.string().uuid().safeParse(id).success)
    return fail('Please try again.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_zones')
    .delete()
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath('/settings/load-priority');
  return ok;
}

// --- Daily board (planner) --------------------------------------------------

/**
 * Create today's board for a shift key and snapshot the active Weekly Master
 * rows for that weekday. Idempotent: returns the existing board if one exists.
 */
export async function createBoard(
  input: z.input<typeof boardCreateSchema>,
): Promise<IdResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const parsed = boardCreateSchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');
  const { shiftKeyId, boardDate } = parsed.data;
  const fid = profile.facilityId;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('load_priority_boards')
    .select('id')
    .eq('facility_id', fid)
    .eq('shift_key_id', shiftKeyId)
    .eq('board_date', boardDate)
    .maybeSingle();
  if (existing) return { ok: true, id: (existing as { id: string }).id };

  const { data: boardRow, error: boardError } = await supabase
    .from('load_priority_boards')
    .insert({
      facility_id: fid,
      shift_key_id: shiftKeyId,
      board_date: boardDate,
      status: 'draft',
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (boardError || !boardRow) return dbFail();
  const boardId = (boardRow as { id: string }).id;

  // Snapshot the active weekly rows for this weekday into the board.
  const { data: weekly } = await supabase
    .from('load_priority_weekly_schedules')
    .select(
      'id, door_number, lane_number, carrier_label, close_time, zone, notes, sort_order',
    )
    .eq('facility_id', fid)
    .eq('weekday', weekdayOf(boardDate))
    .eq('active', true);
  type W = {
    id: string;
    door_number: string;
    lane_number: string | null;
    carrier_label: string | null;
    close_time: string;
    zone: number;
    notes: string | null;
    sort_order: number;
  };
  const rows = ((weekly as W[]) ?? [])
    .slice()
    .sort(
      (a, b) =>
        a.close_time.localeCompare(b.close_time) ||
        a.sort_order - b.sort_order ||
        a.door_number.localeCompare(b.door_number),
    );
  if (rows.length > 0) {
    const { error: entriesError } = await supabase
      .from('load_priority_entries')
      .insert(
        rows.map((w, i) => ({
          board_id: boardId,
          facility_id: fid,
          door_number: w.door_number,
          zone: w.zone,
          lane_number_snapshot: w.lane_number,
          carrier_label_snapshot: w.carrier_label,
          close_time: w.close_time,
          status: 'open',
          notes: w.notes,
          sort_order: i,
          source_weekly_schedule_id: w.id,
        })),
      );
    if (entriesError) return dbFail();
  }

  revalidatePath('/load-priority');
  return { ok: true, id: boardId };
}

export async function publishBoard(boardId: string): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(boardId).success)
    return fail('Please try again.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_boards')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', boardId);
  if (error) return dbFail();
  revalidate();
  return ok;
}

/** Delete a board (draft or published); entries cascade. Audit-logged. */
export async function deleteBoard(boardId: string): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(boardId).success)
    return fail('Please try again.');

  const supabase = await createClient();
  const { data } = await supabase
    .from('load_priority_boards')
    .select('id, board_date, shift_key_id, status')
    .eq('id', boardId)
    .maybeSingle();
  const board = data as {
    id: string;
    board_date: string;
    shift_key_id: string;
    status: string;
  } | null;
  if (!board) return fail('Board not found.');

  const { error } = await supabase
    .from('load_priority_boards')
    .delete()
    .eq('id', boardId);
  if (error) return dbFail();

  await logAudit({
    actionType: 'delete_load_priority_board',
    entityType: 'load_priority_board',
    entityId: boardId,
    oldValue: {
      boardDate: board.board_date,
      shiftKeyId: board.shift_key_id,
      status: board.status,
    },
  });
  revalidate();
  return ok;
}

// --- Entries (planner) ------------------------------------------------------

export async function addEntry(
  boardId: string,
  input: z.input<typeof entrySchema>,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(boardId).success)
    return fail('Please try again.');
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase.from('load_priority_entries').insert({
    board_id: boardId,
    facility_id: profile.facilityId,
    door_number: parsed.data.doorNumber,
    zone: parsed.data.zone,
    lane_number_snapshot: nullable(parsed.data.laneNumber),
    carrier_label_snapshot: nullable(parsed.data.carrierLabel),
    close_time: nullable(parsed.data.closeTime),
    status: 'open',
    notes: nullable(parsed.data.notes),
    sort_order: 999,
  });
  if (error) return dbFail();
  revalidate();
  return ok;
}

export async function updateEntry(
  entryId: string,
  input: z.input<typeof entrySchema>,
): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(entryId).success)
    return fail('Please try again.');
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return fail('Please check the form and try again.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_entries')
    .update({
      door_number: parsed.data.doorNumber,
      zone: parsed.data.zone,
      lane_number_snapshot: nullable(parsed.data.laneNumber),
      carrier_label_snapshot: nullable(parsed.data.carrierLabel),
      close_time: nullable(parsed.data.closeTime),
      notes: nullable(parsed.data.notes),
    })
    .eq('id', entryId);
  if (error) return dbFail();
  revalidate();
  return ok;
}

export async function removeEntry(entryId: string): Promise<ActionResult> {
  await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(entryId).success)
    return fail('Please try again.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_entries')
    .delete()
    .eq('id', entryId);
  if (error) return dbFail();
  revalidate();
  return ok;
}

/** Mark a door closed or reopen it. */
export async function setEntryStatus(
  entryId: string,
  status: 'open' | 'closed',
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(entryId).success)
    return fail('Please try again.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('load_priority_entries')
    .update(
      status === 'closed'
        ? {
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: profile.id,
          }
        : { status: 'open', closed_at: null, closed_by: null },
    )
    .eq('id', entryId);
  if (error) return dbFail();
  revalidate();
  return ok;
}

/**
 * Explicitly promote a daily entry's current values into the Weekly Master
 * Schedule for the board's weekday (upsert per door). Never runs automatically.
 */
export async function saveEntryToWeekly(
  entryId: string,
): Promise<ActionResult> {
  const profile = await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(entryId).success)
    return fail('Please try again.');

  const supabase = await createClient();
  const { data: entryData } = await supabase
    .from('load_priority_entries')
    .select(
      'board_id, door_number, zone, lane_number_snapshot, carrier_label_snapshot, close_time, notes',
    )
    .eq('id', entryId)
    .maybeSingle();
  const entry = entryData as {
    board_id: string;
    door_number: string;
    zone: number;
    lane_number_snapshot: string | null;
    carrier_label_snapshot: string | null;
    close_time: string | null;
    notes: string | null;
  } | null;
  if (!entry) return fail('Entry not found.');
  if (!entry.close_time)
    return fail('Set a close time before saving to the weekly schedule.');

  const { data: boardData } = await supabase
    .from('load_priority_boards')
    .select('board_date')
    .eq('id', entry.board_id)
    .maybeSingle();
  const board = boardData as { board_date: string } | null;
  if (!board) return fail('Board not found.');

  const weekday = weekdayOf(board.board_date);
  const values = {
    lane_number: entry.lane_number_snapshot,
    carrier_label: entry.carrier_label_snapshot,
    close_time: entry.close_time,
    zone: entry.zone,
    active: true,
    notes: entry.notes,
    updated_by: profile.id,
  };

  // Doors may repeat, so there's no unique key to upsert on: update the existing
  // weekly row for this door/weekday when there's exactly one, else insert.
  const { data: existingRows } = await supabase
    .from('load_priority_weekly_schedules')
    .select('id')
    .eq('facility_id', profile.facilityId)
    .eq('weekday', weekday)
    .eq('door_number', entry.door_number)
    .limit(2);
  const matches = (existingRows as { id: string }[] | null) ?? [];

  const { error } =
    matches.length === 1
      ? await supabase
          .from('load_priority_weekly_schedules')
          .update(values)
          .eq('id', matches[0]!.id)
      : await supabase.from('load_priority_weekly_schedules').insert({
          facility_id: profile.facilityId,
          weekday,
          door_number: entry.door_number,
          created_by: profile.id,
          ...values,
        });
  if (error) return dbFail();
  revalidatePath('/load-priority/schedule');
  return ok;
}
