import { addDaysISO, todayISO } from '@/lib/utils/date';

/**
 * Date-range presets for History & Reporting (PRD §9). Pure so it runs the same
 * on the server (queries) and client (filter labels). Ranges are inclusive on
 * both ends, in `YYYY-MM-DD` form to match `plan_date` / `changed_at::date`.
 */
export const RANGE_PRESETS = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'custom',
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  custom: 'Custom range',
};

export function isRangePreset(value: string): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value);
}

export interface DateRange {
  from: string;
  to: string;
}

/** Resolve a preset (+ optional custom bounds) to an inclusive `{ from, to }`. */
export function resolveRange(
  preset: RangePreset,
  from?: string,
  to?: string,
): DateRange {
  const today = todayISO();
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysISO(today, -1);
      return { from: y, to: y };
    }
    case 'last7':
      return { from: addDaysISO(today, -6), to: today };
    case 'last30':
      return { from: addDaysISO(today, -29), to: today };
    case 'custom':
      return {
        from: from || addDaysISO(today, -6),
        to: to || today,
      };
  }
}
