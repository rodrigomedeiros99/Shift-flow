'use client';

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

/**
 * Keeps the Dashboard current: subscribes to the published-plan board tables so
 * KPIs and Recent Activity refresh within seconds of a live change, without a
 * manual reload. Renders nothing.
 */
const DASHBOARD_TABLES = [
  'daily_plans',
  'assignments',
  'special_assignments',
  'activity_history',
] as const;

export function DashboardRealtime() {
  useRealtimeRefresh('dashboard', DASHBOARD_TABLES);
  return null;
}
