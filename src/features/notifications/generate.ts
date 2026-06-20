/**
 * Notification payload builders — pure and IO-free so the server actions that
 * emit them stay thin and testable. Each builder turns already-computed plan
 * facts into a {@link NotificationDraft} (title/message/severity/link + a stable
 * `dedupeKey`). Detection of the *conditions* lives in the planning actions
 * where the data is fetched; this module only shapes the message.
 *
 * Phase 1 types: plan_published, draft_exists, staffing_warning, rotation_alert,
 * uph_warning. Department behavior is never branched by name (rule #1) — the
 * label is just the configured department + shift-key name.
 */
import type { NotificationSeverity, NotificationType } from '@/types/domain';

/** A notification to emit; the recipient + facility are attached by the action. */
export interface NotificationDraft {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string | null;
  /** Stable key for the condition so re-emitting updates instead of duplicating. */
  dedupeKey: string;
}

/** Minimal plan identity used to title/link a notification. */
export interface PlanLabel {
  planId: string;
  deptName: string;
  keyName: string;
}

/** "Outbound — Key 1" style scope label for a plan. */
function scope(plan: PlanLabel): string {
  return [plan.deptName, plan.keyName].filter(Boolean).join(' ').trim();
}

/** Join clauses, keeping the message short with a "+N more" tail when long. */
function summarize(clauses: string[], max = 3): string {
  if (clauses.length <= max) return clauses.join(' ');
  const shown = clauses.slice(0, max).join(' ');
  return `${shown} +${clauses.length - max} more.`;
}

const reviewLink = (planId: string) => `/create-plan/${planId}`;

// --- Plan published ---------------------------------------------------------

export function buildPlanPublished(plan: PlanLabel): NotificationDraft {
  return {
    type: 'plan_published',
    severity: 'info',
    title: `${scope(plan)} plan published`,
    message: `${scope(plan)} plan was published.`,
    link: `/live-plan/${plan.planId}`,
    dedupeKey: `published:${plan.planId}`,
  };
}

// --- Draft exists -----------------------------------------------------------

export function buildDraftExists(plan: PlanLabel): NotificationDraft {
  return {
    type: 'draft_exists',
    severity: 'warning',
    title: `${scope(plan)} draft created`,
    message: `${scope(plan)} draft has not been published yet.`,
    link: reviewLink(plan.planId),
    dedupeKey: `draft:${plan.planId}`,
  };
}

// --- Staffing warning -------------------------------------------------------

export interface StaffingShortfall {
  taskName: string;
  needed: number;
  assigned: number;
}

export function buildStaffingWarning(
  plan: PlanLabel,
  shortfalls: StaffingShortfall[],
): NotificationDraft | null {
  const short = shortfalls.filter((s) => s.assigned < s.needed);
  if (short.length === 0) return null;
  const clauses = short.map(
    (s) =>
      `${s.taskName} requires ${s.needed} but only ${s.assigned} assigned.`,
  );
  return {
    type: 'staffing_warning',
    severity: 'critical',
    title: `${scope(plan)} staffing shortfall`,
    message: summarize(clauses),
    link: reviewLink(plan.planId),
    dedupeKey: `staffing:${plan.planId}`,
  };
}

// --- Fair rotation alert ----------------------------------------------------

export interface RotationConflict {
  associateName: string;
  taskName: string;
}

export function buildRotationAlert(
  plan: PlanLabel,
  conflicts: RotationConflict[],
): NotificationDraft | null {
  if (conflicts.length === 0) return null;
  const clauses = conflicts.map(
    (c) => `${c.associateName} repeats ${c.taskName}.`,
  );
  return {
    type: 'rotation_alert',
    severity: 'warning',
    title: `${scope(plan)} rotation alert`,
    message: summarize(clauses),
    link: reviewLink(plan.planId),
    dedupeKey: `rotation:${plan.planId}`,
  };
}

// --- UPH warning ------------------------------------------------------------

/** Difference at/above this fraction of the UPH recommendation raises a warning. */
export const UPH_WARNING_THRESHOLD = 0.2;

/** Whether staffed headcount diverges from the UPH recommendation enough to warn. */
export function uphExceedsThreshold(
  recommended: number | null,
  staffed: number,
): boolean {
  if (!recommended || recommended <= 0) return false;
  return Math.abs(staffed - recommended) / recommended >= UPH_WARNING_THRESHOLD;
}

export interface UphDelta {
  taskName: string;
  recommended: number;
  staffed: number;
}

export function buildUphWarning(
  plan: PlanLabel,
  deltas: UphDelta[],
): NotificationDraft | null {
  const flagged = deltas.filter((d) =>
    uphExceedsThreshold(d.recommended, d.staffed),
  );
  if (flagged.length === 0) return null;
  const clauses = flagged.map(
    (d) =>
      `${d.taskName} UPH recommends ${d.recommended} but staffing is ${d.staffed}.`,
  );
  return {
    type: 'uph_warning',
    severity: 'warning',
    title: `${scope(plan)} UPH variance`,
    message: summarize(clauses),
    link: reviewLink(plan.planId),
    dedupeKey: `uph:${plan.planId}`,
  };
}
