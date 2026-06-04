/**
 * Auto-generate algorithm for outbound plans (Phase 5), kept pure and IO-free
 * so it's easy to reason about and test. It expands a template into individual
 * slots, fills them from the available associates while respecting equipment
 * certifications, and reports what was filled, what stayed open, and who is left
 * over (the available pool).
 *
 * Fair-rotation preference (Phase 7) is applied as a soft tie-break when a
 * `rotation` index is supplied: among the certified-eligible associates for a
 * slot, prefer those not recently planned for the task, then those who have done
 * it least often. Certification stays a hard constraint; the leader overrides.
 */

import { rotationRank, type RotationIndex } from './rotation';

export interface GenTemplateItem {
  taskTypeId: string | null;
  dockDoorId: string | null;
  defaultEquipmentId: string | null;
  peopleNeeded: number;
  sortOrder: number;
  /**
   * Inbound: expand this item across the plan's active dock doors — one set of
   * `peopleNeeded` slots per active door (the item's fixed dockDoorId is
   * ignored). Outbound items leave this false.
   */
  perActiveDoor: boolean;
}

export interface GenAssociate {
  id: string;
  /** Equipment ids this associate is certified on. */
  certifiedEquipmentIds: string[];
}

export interface GenEquipment {
  id: string;
  certificationRequired: boolean;
}

export interface GenInput {
  templateItems: GenTemplateItem[];
  /** Associates available to assign (call-offs and special-assignment people already removed). */
  availableAssociates: GenAssociate[];
  equipment: GenEquipment[];
  /** Dock doors marked active for this plan (inbound). Drives per-active-door items. */
  activeDoorIds: string[];
  /**
   * Optional fair-rotation context. When present, eligible associates are
   * ranked by `rotationRank` for each slot's task. Omitted → first-eligible
   * (the original deterministic fill).
   */
  rotation?: {
    index: RotationIndex;
    planDate: string;
    lookbackDays: number;
  };
}

/** One produced assignment (a filled slot). */
export interface DraftAssignment {
  associateId: string;
  taskTypeId: string | null;
  equipmentId: string | null;
  dockDoorId: string | null;
}

/** A slot the algorithm could not fill (no eligible associate left). */
export interface OpenSlot {
  taskTypeId: string | null;
  equipmentId: string | null;
  dockDoorId: string | null;
}

export interface GenResult {
  assignments: DraftAssignment[];
  openSlots: OpenSlot[];
  /** Associate ids with no assignment — the available pool. */
  pool: string[];
}

/**
 * Whether an associate may take a slot: only constrained when the slot's
 * equipment requires certification. Slots with no equipment, or equipment that
 * doesn't require certification, are open to anyone.
 */
function isEligible(
  associate: GenAssociate,
  equipmentId: string | null,
  certRequiredByEquipment: Map<string, boolean>,
): boolean {
  if (!equipmentId) return true;
  if (!certRequiredByEquipment.get(equipmentId)) return true;
  return associate.certifiedEquipmentIds.includes(equipmentId);
}

export function generateAssignments(input: GenInput): GenResult {
  const certRequiredByEquipment = new Map(
    input.equipment.map((e) => [e.id, e.certificationRequired]),
  );

  // Expand template items (by people_needed) into individual slots, in order.
  // A per-active-door item fans out across every active door (inbound "Unload
  // per door"); a normal item uses its own fixed dock door.
  const slots: OpenSlot[] = [];
  for (const item of [...input.templateItems].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )) {
    const count = Math.max(0, item.peopleNeeded);
    const doors = item.perActiveDoor ? input.activeDoorIds : [item.dockDoorId];
    for (const doorId of doors) {
      for (let i = 0; i < count; i += 1) {
        slots.push({
          taskTypeId: item.taskTypeId,
          equipmentId: item.defaultEquipmentId,
          dockDoorId: doorId,
        });
      }
    }
  }

  const remaining = [...input.availableAssociates];
  const assignments: DraftAssignment[] = [];
  const openSlots: OpenSlot[] = [];

  // Fill the most-constrained slots first (cert-required equipment), so scarce
  // certified associates aren't consumed by unconstrained slots.
  const orderedSlots = slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => {
      const aReq =
        !!a.slot.equipmentId &&
        !!certRequiredByEquipment.get(a.slot.equipmentId);
      const bReq =
        !!b.slot.equipmentId &&
        !!certRequiredByEquipment.get(b.slot.equipmentId);
      if (aReq !== bReq) return aReq ? -1 : 1;
      return a.index - b.index; // stable: preserve template order otherwise
    });

  const rotation = input.rotation;
  for (const { slot } of orderedSlots) {
    // Scan the certified-eligible associates in original (stable) order. With
    // rotation, keep the fairest: no recent conflict first, then fewer past
    // occurrences. Without rotation, take the first eligible (original fill).
    let pickIndex = -1;
    let bestRank: { recent: 0 | 1; count: number } | null = null;
    for (let i = 0; i < remaining.length; i += 1) {
      const cand = remaining[i];
      if (!cand) continue;
      if (!isEligible(cand, slot.equipmentId, certRequiredByEquipment))
        continue;
      if (!rotation) {
        pickIndex = i;
        break;
      }
      const rank = rotationRank(
        rotation.index,
        cand.id,
        slot.taskTypeId,
        rotation.planDate,
        rotation.lookbackDays,
      );
      if (
        bestRank === null ||
        rank.recent < bestRank.recent ||
        (rank.recent === bestRank.recent && rank.count < bestRank.count)
      ) {
        bestRank = rank;
        pickIndex = i;
      }
    }

    const associate = pickIndex === -1 ? undefined : remaining[pickIndex];
    if (!associate) {
      openSlots.push(slot);
      continue;
    }
    remaining.splice(pickIndex, 1);
    assignments.push({
      associateId: associate.id,
      taskTypeId: slot.taskTypeId,
      equipmentId: slot.equipmentId,
      dockDoorId: slot.dockDoorId,
    });
  }

  return {
    assignments,
    openSlots,
    pool: remaining.map((a) => a.id),
  };
}
