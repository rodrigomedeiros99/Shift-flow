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

/**
 * Step 4 (inbound) — which dock doors are active today, each with the optional
 * equipment chosen for it (equipment changes daily, so it's per plan).
 */
export const activeDoorsSchema = z.object({
  doors: z.array(
    z.object({
      dockDoorId: z.string().uuid(),
      equipmentId: optionalUuid,
    }),
  ),
});
export type ActiveDoorsValues = z.infer<typeof activeDoorsSchema>;

/** Staffing needs — people required per task (v2 replaces templates). */
export const staffingNeedsSchema = z.object({
  rows: z.array(
    z.object({
      taskTypeId: z.string().uuid(),
      peopleNeeded: z.number().int().min(0).max(999),
    }),
  ),
  /**
   * UPH calculation snapshot per task (recommendation tool). Stored separately
   * from `rows` so old plans keep the UPH that was used when they were created.
   */
  uph: z
    .array(
      z.object({
        taskTypeId: z.string().uuid(),
        unitsPlanned: z.number().int().min(0).max(1_000_000),
        uphUsed: z.number().positive().nullable(),
        shiftHoursUsed: z.number().positive().nullable(),
        recommendedPeople: z.number().int().min(0).max(9999).nullable(),
        finalPeople: z.number().int().min(0).max(999),
      }),
    )
    .optional()
    .default([]),
});
export type StaffingNeedsValues = z.infer<typeof staffingNeedsSchema>;

/** Edit / add a board assignment. */
export const assignmentEditSchema = z.object({
  associateId: z.string().uuid('Select an associate'),
  taskTypeId: optionalUuid,
  equipmentId: optionalUuid,
  dockDoorId: optionalUuid,
  notes: optionalText,
});
export type AssignmentEditValues = z.infer<typeof assignmentEditSchema>;
