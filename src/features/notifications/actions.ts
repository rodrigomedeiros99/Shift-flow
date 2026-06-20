'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/features/auth/queries';

/**
 * Notification read-state actions for the recipient. RLS guarantees a user can
 * only touch their own notifications, so these never filter by user explicitly.
 * Read-state changes never delete history (per spec) — "clear" archives.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
function dbFail(): ActionResult {
  return {
    ok: false,
    error: 'Could not update notifications. Please try again.',
  };
}

const idSchema = z.string().uuid();

/** Mark a single notification read (e.g. on click). */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  await requireProfile();
  if (!idSchema.safeParse(id).success) return dbFail();

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return dbFail();
  revalidatePath('/notifications');
  return ok;
}

/** Mark every unread notification read for the current user. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('is_read', false);
  if (error) return dbFail();
  revalidatePath('/notifications');
  return ok;
}

/** Archive (hide) all read notifications — history is retained, not deleted. */
export async function clearReadNotifications(): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ archived_at: new Date().toISOString() })
    .eq('is_read', true)
    .is('archived_at', null);
  if (error) return dbFail();
  revalidatePath('/notifications');
  return ok;
}
