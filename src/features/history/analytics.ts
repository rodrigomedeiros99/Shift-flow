import type { PlannedRow } from './queries';

/**
 * Pure analytics over planned-assignment-history rows (PRD §9). Kept IO-free so
 * the page derives frequency, equipment usage, team distribution, and rotation
 * variety from a single fetched result set. Fairness uses planned history (not
 * activity) per PRD §4.1.
 */

export interface CountRow {
  id: string | null;
  count: number;
}

function countBy(
  rows: PlannedRow[],
  key: (r: PlannedRow) => string | null,
): CountRow[] {
  const counts = new Map<string | null, number>();
  for (const r of rows) {
    const k = key(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
}

/** How often each task was planned (most frequent first). */
export function assignmentFrequency(rows: PlannedRow[]): CountRow[] {
  return countBy(rows, (r) => r.taskTypeId);
}

/** How often each equipment was planned (most frequent first). */
export function equipmentUsage(rows: PlannedRow[]): CountRow[] {
  return countBy(
    rows.filter((r) => r.equipmentId),
    (r) => r.equipmentId,
  );
}

export interface TaskDistribution {
  taskTypeId: string | null;
  total: number;
  perAssociate: { associateId: string; count: number }[];
}

/** Per-task counts across the team — surfaces assignment imbalances (PRD §9). */
export function teamDistribution(rows: PlannedRow[]): TaskDistribution[] {
  const byTask = new Map<string | null, Map<string, number>>();
  for (const r of rows) {
    let assoc = byTask.get(r.taskTypeId);
    if (!assoc) {
      assoc = new Map();
      byTask.set(r.taskTypeId, assoc);
    }
    assoc.set(r.associateId, (assoc.get(r.associateId) ?? 0) + 1);
  }
  return [...byTask.entries()]
    .map(([taskTypeId, assoc]) => {
      const perAssociate = [...assoc.entries()]
        .map(([associateId, count]) => ({ associateId, count }))
        .sort((a, b) => b.count - a.count);
      const total = perAssociate.reduce((sum, a) => sum + a.count, 0);
      return { taskTypeId, total, perAssociate };
    })
    .sort((a, b) => b.total - a.total);
}

export interface RotationVariety {
  distinctTasks: number;
  totalDays: number;
  ratio: number;
  label: string;
  tone: 'success' | 'warning' | 'danger';
}

/**
 * A descriptive variety score for one associate: distinct planned tasks over
 * total planned days. Higher = more rotation. Informational only (PRD §9).
 */
export function rotationVariety(rows: PlannedRow[]): RotationVariety {
  const totalDays = rows.length;
  const distinctTasks = new Set(
    rows.map((r) => r.taskTypeId).filter((t): t is string => !!t),
  ).size;
  const ratio = totalDays === 0 ? 0 : distinctTasks / totalDays;
  if (ratio >= 0.6)
    return {
      distinctTasks,
      totalDays,
      ratio,
      label: 'Excellent',
      tone: 'success',
    };
  if (ratio >= 0.35)
    return { distinctTasks, totalDays, ratio, label: 'Good', tone: 'warning' };
  return {
    distinctTasks,
    totalDays,
    ratio,
    label: 'Needs improvement',
    tone: 'danger',
  };
}
