/**
 * Fair-rotation core (Phase 7), kept pure and IO-free like `generate.ts` so it
 * can run on the server (auto-plan, save-time warnings) and the client (board
 * notices and the rotation score) from the same logic.
 *
 * Rotation is computed from Planned Assignment History only (PRD §7): the dates
 * an associate was *planned* for a task, never live activity. Cert requirements
 * remain a hard constraint elsewhere — this module only expresses the soft
 * "spread tasks out over time" preference, and never blocks the leader.
 */

import { addDaysISO } from '@/lib/utils/date';

/** One planned-history row, reduced to what rotation needs. */
export interface RotationRecord {
  associateId: string;
  taskTypeId: string | null;
  planDate: string;
}

interface TaskStat {
  /** Times the associate was planned for this task in the window (frequency). */
  count: number;
  /** Most recent date (YYYY-MM-DD) the associate was planned for this task. */
  lastDate: string;
}

/** associateId → (taskId → stats) over the loaded window. */
export type RotationIndex = Map<string, Map<string, TaskStat>>;

export function buildRotationIndex(records: RotationRecord[]): RotationIndex {
  const index: RotationIndex = new Map();
  for (const r of records) {
    if (!r.taskTypeId) continue;
    let byTask = index.get(r.associateId);
    if (!byTask) {
      byTask = new Map();
      index.set(r.associateId, byTask);
    }
    const existing = byTask.get(r.taskTypeId);
    if (existing) {
      existing.count += 1;
      if (r.planDate > existing.lastDate) existing.lastDate = r.planDate;
    } else {
      byTask.set(r.taskTypeId, { count: 1, lastDate: r.planDate });
    }
  }
  return index;
}

/**
 * The date this associate was last planned for `taskTypeId` within
 * `[planDate − lookbackDays, planDate)`, or null if none — i.e. a recent repeat.
 */
export function recentConflictDate(
  index: RotationIndex,
  associateId: string,
  taskTypeId: string | null,
  planDate: string,
  lookbackDays: number,
): string | null {
  if (!taskTypeId) return null;
  const stat = index.get(associateId)?.get(taskTypeId);
  if (!stat) return null;
  const lowerBound = addDaysISO(planDate, -Math.max(1, lookbackDays));
  // lastDate must be on/after the lower bound and strictly before the plan date.
  if (stat.lastDate >= lowerBound && stat.lastDate < planDate) {
    return stat.lastDate;
  }
  return null;
}

/** How often the associate was planned for this task over the whole window. */
export function taskCount(
  index: RotationIndex,
  associateId: string,
  taskTypeId: string | null,
): number {
  if (!taskTypeId) return 0;
  return index.get(associateId)?.get(taskTypeId)?.count ?? 0;
}

/** An assignment, reduced to what scoring needs. */
export interface RotationScorable {
  associateId: string;
  taskTypeId: string | null;
}

export interface RotationScore {
  /** 0–100; share of assignments with no recent-repeat conflict. */
  score: number;
  conflicts: number;
  total: number;
}

export function scoreAssignments(
  items: RotationScorable[],
  index: RotationIndex,
  planDate: string,
  lookbackDays: number,
): RotationScore {
  const total = items.length;
  let conflicts = 0;
  for (const item of items) {
    if (
      recentConflictDate(
        index,
        item.associateId,
        item.taskTypeId,
        planDate,
        lookbackDays,
      )
    ) {
      conflicts += 1;
    }
  }
  const score =
    total === 0 ? 100 : Math.round((100 * (total - conflicts)) / total);
  return { score, conflicts, total };
}

/** Qualitative label for a rotation score (PRD §7 confidence buckets). */
export function rotationQuality(score: number): {
  label: string;
  tone: 'success' | 'warning' | 'danger';
} {
  if (score >= 90) return { label: 'Excellent rotation', tone: 'success' };
  if (score >= 75)
    return { label: 'Minor rotation conflicts', tone: 'warning' };
  return { label: 'Several rotation conflicts', tone: 'danger' };
}

/**
 * Ranking key for choosing the fairest associate for a slot's task: lower is
 * better — prefer no recent conflict, then fewer past occurrences. The caller
 * adds the associate's original order as a final stable tie-break.
 */
export function rotationRank(
  index: RotationIndex,
  associateId: string,
  taskTypeId: string | null,
  planDate: string,
  lookbackDays: number,
): { recent: 0 | 1; count: number } {
  const recent = recentConflictDate(
    index,
    associateId,
    taskTypeId,
    planDate,
    lookbackDays,
  )
    ? 1
    : 0;
  return { recent, count: taskCount(index, associateId, taskTypeId) };
}
