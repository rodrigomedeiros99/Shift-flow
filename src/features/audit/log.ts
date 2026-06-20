import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/features/auth/queries';

/**
 * Append-only audit logging (Phase 10). Records important actions for review at
 * `/settings/audit`. Deliberately **best-effort**: a failure to log must never
 * break the underlying action, so all errors are swallowed (logged to server
 * console only). RLS lets any authenticated facility user insert their own row.
 */

export type AuditAction =
  | 'create_plan'
  | 'publish_plan'
  | 'close_shift'
  | 'moved_associate'
  | 'switched_assignment'
  | 'delete_draft';

interface LogAuditInput {
  actionType: AuditAction;
  entityType?: string;
  entityId?: string | null;
  dailyPlanId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return;
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      facility_id: profile.facilityId,
      user_id: profile.id,
      daily_plan_id: input.dailyPlanId ?? null,
      action_type: input.actionType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
    });
  } catch (error) {
    // Never let auditing break the real work.
    console.error('Audit log failed:', error);
  }
}
