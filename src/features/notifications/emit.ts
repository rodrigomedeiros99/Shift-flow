import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { PlanLabel, NotificationDraft } from './generate';

/**
 * Server-side notification emission used by the planning actions. Kept separate
 * from the user-facing `actions.ts` ('use server') so it can export plain
 * helpers. Emission must never break the planning flow it rides along with, so
 * every failure is logged and swallowed.
 */

export interface EmitContext {
  facilityId: string;
  /** Recipient — the plan's creator in Phase 1 (per-creator model). */
  recipientUserId: string;
  dailyPlanId: string | null;
}

/**
 * Upsert each draft on (facility_id, dedupe_key): a recurring condition updates
 * its existing row and resurfaces it (unread, un-archived, bumped to now)
 * instead of creating a duplicate.
 */
export async function emitNotifications(
  ctx: EmitContext,
  drafts: NotificationDraft[],
): Promise<void> {
  if (drafts.length === 0) return;
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const rows = drafts.map((d) => ({
      facility_id: ctx.facilityId,
      user_id: ctx.recipientUserId,
      type: d.type,
      severity: d.severity,
      title: d.title,
      message: d.message,
      link: d.link,
      dedupe_key: d.dedupeKey,
      daily_plan_id: ctx.dailyPlanId,
      is_read: false,
      read_at: null,
      archived_at: null,
      created_at: now,
    }));
    const { error } = await supabase
      .from('notifications')
      .upsert(rows, { onConflict: 'facility_id,dedupe_key' });
    if (error) console.error('emitNotifications:', error.message);
  } catch (err) {
    console.error('emitNotifications:', err);
  }
}

/** Remove notifications for resolved conditions (e.g. a draft that was published). */
export async function clearNotificationsByDedupe(
  facilityId: string,
  dedupeKeys: string[],
): Promise<void> {
  if (dedupeKeys.length === 0) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('facility_id', facilityId)
      .in('dedupe_key', dedupeKeys);
    if (error) console.error('clearNotificationsByDedupe:', error.message);
  } catch (err) {
    console.error('clearNotificationsByDedupe:', err);
  }
}

/** Resolve a plan's department + shift-key names for notification titles. */
export async function loadPlanLabel(plan: {
  id: string;
  departmentId: string;
  shiftKeyId: string;
}): Promise<PlanLabel> {
  let deptName = '';
  let keyName = '';
  try {
    const supabase = await createClient();
    const [{ data: dept }, { data: key }] = await Promise.all([
      supabase
        .from('departments')
        .select('name')
        .eq('id', plan.departmentId)
        .maybeSingle(),
      supabase
        .from('shift_keys')
        .select('name')
        .eq('id', plan.shiftKeyId)
        .maybeSingle(),
    ]);
    deptName = (dept as { name: string } | null)?.name ?? '';
    keyName = (key as { name: string } | null)?.name ?? '';
  } catch (err) {
    console.error('loadPlanLabel:', err);
  }
  return { planId: plan.id, deptName, keyName };
}
