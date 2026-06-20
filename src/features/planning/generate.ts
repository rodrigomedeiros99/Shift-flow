/**
 * Auto-generate algorithm (v2), kept pure and IO-free so it's easy to reason
 * about and test. The plan's demand now comes from **staffing needs** (people
 * per task) plus, for inbound, the **active dock doors** (one unload slot per
 * door) — templates are no longer used. It expands that demand into individual
 * slots, fills them from the available associates respecting equipment
 * certifications, applies a soft fair-rotation preference, and reports what was
 * filled, what stayed open, and who is left over (the available pool).
 */

import { rotationRank, type RotationIndex } from './rotation';

export interface GenStaffingItem {
  taskTypeId: string;
  /** Default equipment for the task (config-driven), or null. */
  equipmentId: string | null;
  peopleNeeded: number;
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

/** An active dock door = one unload position: door + per-day equipment + task. */
export interface GenActiveDoor {
  dockDoorId: string;
  equipmentId: string | null;
  /** The door-driven task this position fills (e.g. Unload), or null. */
  taskTypeId: string | null;
}

export interface GenInput {
  /** People-per-task demand (outbound, and inbound non-door tasks). */
  staffingItems: GenStaffingItem[];
  /** Active dock doors (inbound): each becomes one unload slot. */
  activeDoors: GenActiveDoor[];
  /** Associates available to assign (call-offs and special people already removed). */
  availableAssociates: GenAssociate[];
  equipment: GenEquipment[];
  /** Optional fair-rotation context; omitted → first-eligible fill. */
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

  // Expand demand into individual slots: task staffing first (in given order),
  // then one slot per active dock door (inbound unload).
  const slots: OpenSlot[] = [];
  for (const item of input.staffingItems) {
    const count = Math.max(0, item.peopleNeeded);
    for (let i = 0; i < count; i += 1) {
      slots.push({
        taskTypeId: item.taskTypeId,
        equipmentId: item.equipmentId,
        dockDoorId: null,
      });
    }
  }
  for (const door of input.activeDoors) {
    slots.push({
      taskTypeId: door.taskTypeId,
      equipmentId: door.equipmentId,
      dockDoorId: door.dockDoorId,
    });
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
      return a.index - b.index; // stable: preserve demand order otherwise
    });

  const rotation = input.rotation;
  for (const { slot } of orderedSlots) {
    // Scan certified-eligible associates in original (stable) order. With
    // rotation, keep the fairest: no recent conflict first, then fewer past
    // occurrences. Without rotation, take the first eligible.
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
