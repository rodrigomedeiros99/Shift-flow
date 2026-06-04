import { z } from 'zod';

/**
 * Validation schemas for planning templates (Phase 4). Same conventions as the
 * config schemas (Engineering Standards §1/§3): validate every input with Zod,
 * client and server share the inferred types, and schemas stay free of
 * output-changing transforms (no `.transform`, no `.default`) so the
 * react-hook-form value type equals the validated type. Empty optional strings
 * (`''`) mean "none" and are normalized to `null` inside the server actions.
 */

const name = z.string().trim().min(1, 'Required').max(80, 'Too long');
const optionalText = z.string().trim().max(500, 'Too long').optional();
// '' means "not selected"; normalized to null in the action.
const optionalUuid = z.union([z.string().uuid(), z.literal('')]);

/** Template header: scoped by department (inbound/outbound) and shift key. */
export const templateSchema = z.object({
  name,
  departmentId: z.string().uuid('Select a department'),
  shiftKeyId: z.string().uuid('Select a shift key'),
  active: z.boolean(),
});
export type TemplateFormValues = z.infer<typeof templateSchema>;

/**
 * A single line item inside a template (a planned slot). Position is not part
 * of the form — items append on create and are reordered with the ▲▼ controls,
 * so `sort_order` is managed by the server, not entered by hand.
 */
export const templateItemSchema = z.object({
  taskTypeId: z.string().uuid('Select a task'),
  dockDoorId: optionalUuid,
  defaultEquipmentId: optionalUuid,
  peopleNeeded: z.number().int().min(1, 'At least 1').max(999, 'Too many'),
  // Inbound: expand this item across the plan's active dock doors at generation.
  perActiveDoor: z.boolean(),
  notes: optionalText,
});
export type TemplateItemFormValues = z.infer<typeof templateItemSchema>;
