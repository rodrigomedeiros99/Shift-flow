import { z } from 'zod';

/**
 * Validation for the Load Priority module. Same conventions as the config/live
 * schemas: no output-changing transforms; `''→null` normalization in the actions.
 */

const optionalText = z.string().trim().max(200, 'Too long').optional();
const timeStr = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');
const optionalTime = z.union([timeStr, z.literal('')]);
const doorNumber = z.string().trim().min(1, 'Required').max(20, 'Too long');
const zone = z.coerce.number().int().min(1, 'Zone must be ≥ 1').max(99);

/** One recurring row of the Weekly Master Schedule. */
export const weeklyRowSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  doorNumber,
  laneNumber: optionalText,
  carrierLabel: optionalText,
  closeTime: timeStr,
  zone,
  active: z.boolean(),
  notes: optionalText,
});
export type WeeklyRowValues = z.infer<typeof weeklyRowSchema>;

/** A configurable zone range (Zone N = doors low..high). */
export const zoneRangeSchema = z.object({
  zone,
  doorLow: z.coerce.number().int().min(0),
  doorHigh: z.coerce.number().int().min(0),
  active: z.boolean(),
});
export type ZoneRangeValues = z.infer<typeof zoneRangeSchema>;

/** Create a daily board. */
export const boardCreateSchema = z.object({
  shiftKeyId: z.string().uuid('Select a shift key'),
  boardDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});
export type BoardCreateValues = z.infer<typeof boardCreateSchema>;

/** Add / edit a single door entry on a board (today-only snapshot). */
export const entrySchema = z.object({
  doorNumber,
  zone,
  laneNumber: optionalText,
  carrierLabel: optionalText,
  closeTime: optionalTime,
  notes: optionalText,
});
export type EntryValues = z.infer<typeof entrySchema>;
