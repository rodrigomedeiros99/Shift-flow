import { z } from 'zod';

/**
 * Validation schemas for outbound planning (Phase 5). Same conventions as the
 * config/templates schemas: validate every input with Zod, share inferred types
 * with the forms, no output-changing transforms, and normalize `''→null` in the
 * server actions (not here).
 */

const optionalText = z.string().trim().max(500, 'Too long').optional();
const optionalUuid = z.union([z.string().uuid(), z.literal('')]);

/** Step 2 — choose the plan's department (outbound), key, and date. */
export const planSetupSchema = z.object({
  departmentId: z.string().uuid('Select a department'),
  shiftKeyId: z.string().uuid('Select a key'),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});
export type PlanSetupValues = z.infer<typeof planSetupSchema>;

/** Overtime support: associate + task + optional equipment. */
export const overtimeEntrySchema = z.object({
  associateId: z.string().uuid('Select an associate'),
  taskTypeId: z.string().uuid('Select a task'),
  equipmentId: optionalUuid,
  notes: optionalText,
});
export type OvertimeEntryValues = z.infer<typeof overtimeEntrySchema>;

/** A simple special assignment (Middle Mile, ICQA, Support) — task optional. */
export const specialAssignmentSchema = z.object({
  associateId: z.string().uuid('Select an associate'),
  taskTypeId: optionalUuid,
  equipmentId: optionalUuid,
  notes: optionalText,
});
export type SpecialAssignmentValues = z.infer<typeof specialAssignmentSchema>;

/** Training pair: trainer + new hire on a task. */
export const trainingPairSchema = z.object({
  associateId: z.string().uuid('Select a trainer'),
  relatedAssociateId: z.string().uuid('Select a new hire'),
  taskTypeId: z.string().uuid('Select a task'),
  equipmentId: optionalUuid,
  notes: optionalText,
});
export type TrainingPairValues = z.infer<typeof trainingPairSchema>;

/** Step 4 (inbound) — which dock doors are active for the plan today. */
export const activeDoorsSchema = z.object({
  doorIds: z.array(z.string().uuid()),
});
export type ActiveDoorsValues = z.infer<typeof activeDoorsSchema>;

/** Edit / add a board assignment. */
export const assignmentEditSchema = z.object({
  associateId: z.string().uuid('Select an associate'),
  taskTypeId: optionalUuid,
  equipmentId: optionalUuid,
  dockDoorId: optionalUuid,
  notes: optionalText,
});
export type AssignmentEditValues = z.infer<typeof assignmentEditSchema>;
