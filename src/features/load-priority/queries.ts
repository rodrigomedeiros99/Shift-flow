import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/utils/date';
import type {
  LoadPriorityBoard,
  LoadPriorityDoorStatus,
  LoadPriorityEntry,
  LoadPriorityStatus,
  LoadPriorityWeeklySchedule,
  LoadPriorityZone,
} from '@/types/domain';

/**
 * Read model for the Load Priority module. RLS scopes every query to the
 * caller's facility. Time columns come back as `HH:MM:SS`; we trim to `HH:MM`.
 */

async function db() {
  return createClient();
}
function fail(entity: string, message: string): never {
  throw new Error(`Failed to load ${entity}: ${message}`);
}
const hhmm = (t: string | null): string | null => (t ? t.slice(0, 5) : null);

// --- Weekly master schedule -------------------------------------------------

interface WeeklyRow {
  id: string;
  facility_id: string;
  weekday: number;
  door_number: string;
  lane_number: string | null;
  carrier_label: string | null;
  close_time: string;
  zone: number;
  active: boolean;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
const toWeekly = (r: WeeklyRow): LoadPriorityWeeklySchedule => ({
  id: r.id,
  facilityId: r.facility_id,
  weekday: r.weekday,
  doorNumber: r.door_number,
  laneNumber: r.lane_number,
  carrierLabel: r.carrier_label,
  closeTime: hhmm(r.close_time) ?? '',
  zone: r.zone,
  active: r.active,
  notes: r.notes,
  sortOrder: r.sort_order,
  createdBy: r.created_by,
  updatedBy: r.updated_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const WEEKLY_COLS =
  'id, facility_id, weekday, door_number, lane_number, carrier_label, close_time, zone, active, notes, sort_order, created_by, updated_by, created_at, updated_at';

export async function listWeeklySchedules(): Promise<
  LoadPriorityWeeklySchedule[]
> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_weekly_schedules')
    .select(WEEKLY_COLS)
    .order('weekday')
    .order('sort_order')
    .order('close_time');
  if (error) fail('weekly schedules', error.message);
  return ((data as WeeklyRow[] | null) ?? []).map(toWeekly);
}

/** Active-row counts per weekday (0–6), for the home-page overview. */
export async function weeklyCountsByWeekday(): Promise<Record<number, number>> {
  const rows = await listWeeklySchedules();
  const counts: Record<number, number> = {};
  for (const r of rows)
    if (r.active) counts[r.weekday] = (counts[r.weekday] ?? 0) + 1;
  return counts;
}

// --- Zone ranges ------------------------------------------------------------

interface ZoneRow {
  id: string;
  facility_id: string;
  zone: number;
  door_low: number;
  door_high: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
const toZone = (r: ZoneRow): LoadPriorityZone => ({
  id: r.id,
  facilityId: r.facility_id,
  zone: r.zone,
  doorLow: r.door_low,
  doorHigh: r.door_high,
  active: r.active,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const ZONE_COLS =
  'id, facility_id, zone, door_low, door_high, active, sort_order, created_at, updated_at';

export async function listZones(): Promise<LoadPriorityZone[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_zones')
    .select(ZONE_COLS)
    .order('zone')
    .order('door_low');
  if (error) fail('zones', error.message);
  return ((data as ZoneRow[] | null) ?? []).map(toZone);
}

// --- Boards -----------------------------------------------------------------

interface BoardRow {
  id: string;
  facility_id: string;
  shift_key_id: string;
  board_date: string;
  status: LoadPriorityStatus;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
const toBoard = (r: BoardRow): LoadPriorityBoard => ({
  id: r.id,
  facilityId: r.facility_id,
  shiftKeyId: r.shift_key_id,
  boardDate: r.board_date,
  status: r.status,
  createdBy: r.created_by,
  publishedAt: r.published_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const BOARD_COLS =
  'id, facility_id, shift_key_id, board_date, status, created_by, published_at, created_at, updated_at';

export async function listBoards(limit = 30): Promise<LoadPriorityBoard[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_boards')
    .select(BOARD_COLS)
    .order('board_date', { ascending: false })
    .limit(limit);
  if (error) fail('boards', error.message);
  return ((data as BoardRow[] | null) ?? []).map(toBoard);
}

export async function getBoard(id: string): Promise<LoadPriorityBoard | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_boards')
    .select(BOARD_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) fail('board', error.message);
  return data ? toBoard(data as BoardRow) : null;
}

export async function getBoardForDateKey(
  boardDate: string,
  shiftKeyId: string,
): Promise<LoadPriorityBoard | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_boards')
    .select(BOARD_COLS)
    .eq('board_date', boardDate)
    .eq('shift_key_id', shiftKeyId)
    .maybeSingle();
  if (error) fail('board', error.message);
  return data ? toBoard(data as BoardRow) : null;
}

// --- Entries ----------------------------------------------------------------

interface EntryRow {
  id: string;
  board_id: string;
  facility_id: string;
  door_number: string;
  zone: number;
  lane_number_snapshot: string | null;
  carrier_label_snapshot: string | null;
  close_time: string | null;
  status: LoadPriorityDoorStatus;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  sort_order: number;
  source_weekly_schedule_id: string | null;
  created_at: string;
  updated_at: string;
}
const toEntry = (r: EntryRow): LoadPriorityEntry => ({
  id: r.id,
  boardId: r.board_id,
  facilityId: r.facility_id,
  doorNumber: r.door_number,
  zone: r.zone,
  laneNumberSnapshot: r.lane_number_snapshot,
  carrierLabelSnapshot: r.carrier_label_snapshot,
  closeTime: hhmm(r.close_time),
  status: r.status,
  closedAt: r.closed_at,
  closedBy: r.closed_by,
  notes: r.notes,
  sortOrder: r.sort_order,
  sourceWeeklyScheduleId: r.source_weekly_schedule_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const ENTRY_COLS =
  'id, board_id, facility_id, door_number, zone, lane_number_snapshot, carrier_label_snapshot, close_time, status, closed_at, closed_by, notes, sort_order, source_weekly_schedule_id, created_at, updated_at';

export async function listEntries(
  boardId: string,
): Promise<LoadPriorityEntry[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_entries')
    .select(ENTRY_COLS)
    .eq('board_id', boardId)
    .order('sort_order');
  if (error) fail('entries', error.message);
  return ((data as EntryRow[] | null) ?? []).map(toEntry);
}

/** Today's most recently published board + its entries (the TV board). */
export async function getTvBoard(): Promise<{
  board: LoadPriorityBoard;
  entries: LoadPriorityEntry[];
} | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from('load_priority_boards')
    .select(BOARD_COLS)
    .eq('board_date', todayISO())
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail('TV board', error.message);
  if (!data) return null;
  const board = toBoard(data as BoardRow);
  const entries = await listEntries(board.id);
  return { board, entries };
}
