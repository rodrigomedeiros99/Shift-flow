/**
 * Fair-rotation *suggestion* engine (pure, IO-free like `rotation.ts`). Given a
 * conflicted assignment, it searches the other planned assignments for a task
 * swap that improves overall rotation without creating an invalid
 * equipment/certification assignment. The swap it proposes is exactly what
 * `switchAssignments` performs (exchange task + equipment between two
 * assignments, associates stay put), so "Apply" just calls that action.
 *
 * Suggestions are advisory: the engine returns the single best improving swap,
 * or null when none helps — the supervisor is never blocked.
 */

import { recentConflictDate, taskCount, type RotationIndex } from './rotation';

/** An assignment reduced to what swapping/scoring needs. */
export interface SwapAssignment {
  id: string;
  associateId: string;
  taskTypeId: string | null;
  equipmentId: string | null;
}

/** Certification context so we never suggest an invalid swap. */
export interface CertContext {
  /** associateId → equipment ids they're certified on. */
  certifiedByAssociate: Map<string, string[]>;
  /** equipmentId → whether certification is required to use it. */
  certRequiredByEquipment: Map<string, boolean>;
}

export interface SwapSuggestion {
  /** The assignment to switch the target with. */
  partnerAssignmentId: string;
  partnerAssociateId: string;
  /** Whole-board rotation score before and after applying the swap (0–100). */
  beforeScore: number;
  afterScore: number;
}

/** Whether an associate may take a slot's equipment (cert is the only gate). */
function eligible(
  associateId: string,
  equipmentId: string | null,
  ctx: CertContext,
): boolean {
  if (!equipmentId) return true;
  if (!ctx.certRequiredByEquipment.get(equipmentId)) return true;
  return (ctx.certifiedByAssociate.get(associateId) ?? []).includes(
    equipmentId,
  );
}

function isConflict(
  index: RotationIndex,
  associateId: string,
  taskTypeId: string | null,
  planDate: string,
  lookbackDays: number,
): 0 | 1 {
  return recentConflictDate(
    index,
    associateId,
    taskTypeId,
    planDate,
    lookbackDays,
  )
    ? 1
    : 0;
}

function scoreFromConflicts(total: number, conflicts: number): number {
  return total === 0 ? 100 : Math.round((100 * (total - conflicts)) / total);
}

/**
 * Find the best task swap for `targetId` that reduces total recent-repeat
 * conflicts while staying certification-valid. Returns null if no swap helps.
 */
export function suggestSwap(
  targetId: string,
  assignments: SwapAssignment[],
  index: RotationIndex,
  planDate: string,
  lookbackDays: number,
  ctx: CertContext,
): SwapSuggestion | null {
  const target = assignments.find((a) => a.id === targetId);
  if (!target) return null;

  const total = assignments.length;
  let baseConflicts = 0;
  for (const a of assignments) {
    baseConflicts += isConflict(
      index,
      a.associateId,
      a.taskTypeId,
      planDate,
      lookbackDays,
    );
  }

  const oldA = isConflict(
    index,
    target.associateId,
    target.taskTypeId,
    planDate,
    lookbackDays,
  );

  // Track the largest conflict reduction; tie-break toward resolving the target
  // and then a fresher (less-repeated) task for the moved associates.
  let best: SwapSuggestion | null = null;
  let bestDelta = 0; // only accept strict improvements (delta < 0)
  let bestResolvesTarget = false;
  let bestFreshness = Number.POSITIVE_INFINITY;

  for (const partner of assignments) {
    if (partner.id === target.id) continue;
    // A pure same-task swap changes nothing for rotation.
    if (partner.taskTypeId === target.taskTypeId) continue;
    // Don't propose a swap that breaks either certification.
    if (!eligible(target.associateId, partner.equipmentId, ctx)) continue;
    if (!eligible(partner.associateId, target.equipmentId, ctx)) continue;

    const oldB = isConflict(
      index,
      partner.associateId,
      partner.taskTypeId,
      planDate,
      lookbackDays,
    );
    const newA = isConflict(
      index,
      target.associateId,
      partner.taskTypeId,
      planDate,
      lookbackDays,
    );
    const newB = isConflict(
      index,
      partner.associateId,
      target.taskTypeId,
      planDate,
      lookbackDays,
    );

    const delta = newA + newB - (oldA + oldB);
    if (delta >= 0) continue; // not an improvement

    const resolvesTarget = newA === 0;
    const freshness =
      taskCount(index, target.associateId, partner.taskTypeId) +
      taskCount(index, partner.associateId, target.taskTypeId);

    const better =
      delta < bestDelta ||
      (delta === bestDelta && resolvesTarget && !bestResolvesTarget) ||
      (delta === bestDelta &&
        resolvesTarget === bestResolvesTarget &&
        freshness < bestFreshness);

    if (better) {
      bestDelta = delta;
      bestResolvesTarget = resolvesTarget;
      bestFreshness = freshness;
      best = {
        partnerAssignmentId: partner.id,
        partnerAssociateId: partner.associateId,
        beforeScore: scoreFromConflicts(total, baseConflicts),
        afterScore: scoreFromConflicts(total, baseConflicts + delta),
      };
    }
  }

  return best;
}
