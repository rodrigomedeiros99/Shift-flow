'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { getBoard, listZones } from '@/features/load-priority/queries';
import { parseWorkbook } from './parse';
import { detectMapping, type ColumnMapping } from './mapping';
import type { LoadPriorityZone } from '@/types/domain';

/**
 * Import mutations. Planner-gated; viewers cannot import. Parsing runs
 * server-side; the client re-maps + reviews the returned matrix. Imports target
 * either the DAILY draft board (create/append) or the WEEKLY master schedule —
 * both go through review, never overwrite silently, never auto-publish.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type ParseScheduleResult =
  | {
      ok: true;
      headers: string[];
      rows: string[][];
      mapping: ColumnMapping;
      /** Configured zone ranges, for client-side auto-assignment. */
      zones: LoadPriorityZone[];
    }
  | { ok: false; error: string };

function fileKind(name: string): 'xlsx' | 'csv' | 'xls' | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xls')) return 'xls';
  return null;
}

export async function parseSchedule(
  formData: FormData,
): Promise<ParseScheduleResult> {
  await requireRole(PLANNER_ROLES);

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No file uploaded.' };
  if (file.size === 0) return { ok: false, error: 'The file is empty.' };
  if (file.size > MAX_BYTES)
    return { ok: false, error: 'File is too large (max 5 MB).' };

  const kind = fileKind(file.name);
  if (kind === 'xls')
    return {
      ok: false,
      error: 'Legacy .xls isn’t supported yet — save the file as .xlsx or CSV.',
    };
  if (kind !== 'xlsx' && kind !== 'csv')
    return { ok: false, error: 'Unsupported file type. Upload .xlsx or .csv.' };

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseWorkbook(buffer, kind);
  } catch {
    return {
      ok: false,
      error: 'Could not read the file. Is it a valid sheet?',
    };
  }
  if (parsed.headers.length === 0)
    return { ok: false, error: 'No rows found in the file.' };

  const zones = await listZones();

  return {
    ok: true,
    headers: parsed.headers,
    rows: parsed.rows,
    mapping: detectMapping(parsed.headers),
    zones,
  };
}

// --- Confirm import ---------------------------------------------------------

const importRowSchema = z.object({
  doorNumber: z.string().trim().min(1).max(20),
  zone: z.number().int().min(1).max(99),
  laneNumber: z.string().trim().max(50).optional(),
  carrierLabel: z.string().trim().max(50).optional(),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: z.string().trim().max(200).optional(),
});
const importPayloadSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
});

function nullable(value: string | undefined): string | null {
  return value && value !== '' ? value : null;
}

export type ImportResult =
  | { ok: true; imported: number }
  | { ok: false; error: string };

/** Import reviewed rows into a DAILY draft board (append; skips existing doors). */
export async function importEntries(
  boardId: string,
  input: z.input<typeof importPayloadSchema>,
): Promise<ImportResult> {
  const profile = await requireRole(PLANNER_ROLES);
  if (!z.string().uuid().safeParse(boardId).success)
    return { ok: false, error: 'Please try again.' };
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'Some rows are invalid. Review and try again.' };

  const board = await getBoard(boardId);
  if (!board) return { ok: false, error: 'Board not found.' };
  if (board.status !== 'draft')
    return {
      ok: false,
      error:
        'Imports only add to draft boards. This board is already published.',
    };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('load_priority_entries')
    .insert(
      parsed.data.rows.map((r, i) => ({
        board_id: boardId,
        facility_id: profile.facilityId,
        door_number: r.doorNumber,
        zone: r.zone,
        lane_number_snapshot: nullable(r.laneNumber),
        carrier_label_snapshot: nullable(r.carrierLabel),
        close_time: r.closeTime,
        status: 'open',
        notes: nullable(r.notes),
        sort_order: i,
      })),
    )
    .select('id');
  if (error) return { ok: false, error: 'Could not import. Please try again.' };

  revalidatePath('/load-priority');
  revalidatePath(`/load-priority/${boardId}`);
  revalidatePath('/load-priority-tv');
  return { ok: true, imported: data?.length ?? 0 };
}

const importWeeklySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  rows: z.array(importRowSchema).min(1).max(500),
});

/** Import reviewed rows into the WEEKLY master for a weekday (upsert per door). */
export async function importWeekly(
  input: z.input<typeof importWeeklySchema>,
): Promise<ImportResult> {
  const profile = await requireRole(PLANNER_ROLES);
  const parsed = importWeeklySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'Some rows are invalid. Review and try again.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('load_priority_weekly_schedules')
    .insert(
      parsed.data.rows.map((r, i) => ({
        facility_id: profile.facilityId,
        weekday: parsed.data.weekday,
        door_number: r.doorNumber,
        lane_number: nullable(r.laneNumber),
        carrier_label: nullable(r.carrierLabel),
        close_time: r.closeTime,
        zone: r.zone,
        active: true,
        notes: nullable(r.notes),
        sort_order: i,
        created_by: profile.id,
        updated_by: profile.id,
      })),
    )
    .select('id');
  if (error) return { ok: false, error: 'Could not import. Please try again.' };

  revalidatePath('/load-priority/schedule');
  revalidatePath('/load-priority');
  return { ok: true, imported: data?.length ?? 0 };
}
