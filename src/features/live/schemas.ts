import { z } from 'zod';

/**
 * Validation for Live Operations. Same conventions as the planning schemas:
 * no output-changing transforms, `''→null` normalized in the actions.
 */

const optionalText = z.string().trim().max(500, 'Too long').optional();
const optionalUuid = z.union([z.string().uuid(), z.literal('')]);

/** Move an existing card: the associate is fixed, what they do changes. */
export const moveSchema = z.object({
  taskTypeId: optionalUuid,
  equipmentId: optionalUuid,
  dockDoorId: optionalUuid,
  notes: optionalText,
});
export type MoveValues = z.infer<typeof moveSchema>;

/**
 * Support destinations a live associate can be moved to (schedule/pay states
 * like Overtime and planned Training are intentionally excluded).
 */
export const LIVE_SUPPORT_MOVE_TYPES = [
  'middle_mile',
  'icqa_support',
  'ib_support',
  'support_outbound',
] as const;

/** Move a live associate onto a support/special assignment. */
export const supportMoveSchema = z.object({
  targetType: z.enum(LIVE_SUPPORT_MOVE_TYPES),
  equipmentId: optionalUuid,
  notes: optionalText,
});
export type SupportMoveValues = z.infer<typeof supportMoveSchema>;

/** Assign someone (from the pool or new) to live work. */
export const poolAssignSchema = z.object({
  associateId: z.string().uuid('Select an associate'),
  taskTypeId: optionalUuid,
  equipmentId: optionalUuid,
  dockDoorId: optionalUuid,
  notes: optionalText,
});
export type PoolAssignValues = z.infer<typeof poolAssignSchema>;
