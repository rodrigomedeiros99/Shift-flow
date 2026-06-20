import { z } from 'zod';

/**
 * Validation schemas for configuration entities (Engineering Standards §1/§3:
 * validate every input with Zod, client and server). The inferred types drive
 * the react-hook-form forms so client and server share one source of truth.
 *
 * Schemas stay free of output-changing transforms (no `.transform`, no
 * `.default`) so the form value type equals the validated type — this keeps
 * `zodResolver` aligned with `useForm`. Empty optional strings are normalized to
 * `null` inside the server actions, not here.
 */

const name = z.string().trim().min(1, 'Required').max(80, 'Too long');

/**
 * A positive number entered as text, or empty for "not set". Kept as a string
 * (like the optional-uuid fields) so the form value type matches the validated
 * type; the server action parses `'' → null` and the rest to a number.
 */
const positiveNumberOrEmpty = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0),
    'Enter a number greater than 0',
  );
const optionalText = z.string().trim().max(500, 'Too long').optional();

export const equipmentSchema = z.object({
  name,
  certificationRequired: z.boolean(),
  active: z.boolean(),
});
export type EquipmentFormValues = z.infer<typeof equipmentSchema>;

export const departmentSchema = z.object({
  name,
  kind: z.enum(['inbound', 'outbound', 'support', 'other']),
  active: z.boolean(),
});
export type DepartmentFormValues = z.infer<typeof departmentSchema>;

export const taskSchema = z.object({
  name,
  departmentId: z.string().uuid('Select a department'),
  // '' means "no default equipment"; normalized to null in the action.
  defaultEquipmentId: z.union([z.string().uuid(), z.literal('')]),
  // Inbound: staffed per active dock door rather than by a people count.
  needsDockDoor: z.boolean(),
  // UPH labor calculator: whether it applies, and the rate ('' = not configured).
  usesUph: z.boolean(),
  avgUnitsPerHour: positiveNumberOrEmpty,
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
});
export type TaskFormValues = z.infer<typeof taskSchema>;

export const dockDoorSchema = z.object({
  doorNumber: z.string().trim().min(1, 'Required').max(20, 'Too long'),
  notes: optionalText,
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
});
export type DockDoorFormValues = z.infer<typeof dockDoorSchema>;

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

export const shiftKeySchema = z.object({
  name,
  startTime: time,
  endTime: time,
  daysOfWeek: z.string().trim().min(1, 'Required').max(40, 'Too long'),
  // Productive hours for the UPH calculator ('' = not configured).
  productiveHours: positiveNumberOrEmpty,
  active: z.boolean(),
});
export type ShiftKeyFormValues = z.infer<typeof shiftKeySchema>;

export const associateSchema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(60, 'Too long'),
  lastName: z.string().trim().min(1, 'Required').max(60, 'Too long'),
  employeeId: z.string().trim().max(40, 'Too long').optional(),
  departmentId: z.string().uuid('Select a department'),
  defaultKeyId: z.string().uuid('Select a default key'),
  certificationIds: z.array(z.string().uuid()),
  notes: optionalText,
  active: z.boolean(),
});
export type AssociateFormValues = z.infer<typeof associateSchema>;
