'use client';

import { useRealtimeRefresh } from './use-realtime-refresh';

/**
 * Live TV updates (Phase 8). Subscribes to the published-plan board tables so
 * the display refreshes within seconds of any change, without a manual reload.
 */
const TV_TABLES = [
  'daily_plans',
  'assignments',
  'special_assignments',
  'plan_dock_doors',
] as const;

export function useTvRealtime(channelKey: string): void {
  useRealtimeRefresh(`tv-${channelKey}`, TV_TABLES);
}
