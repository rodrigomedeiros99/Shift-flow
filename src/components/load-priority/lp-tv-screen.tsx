'use client';

import { useEffect, useMemo, useState } from 'react';
import { TvBackground } from '@/components/tv/tv-background';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import {
  formatCloseTime,
  minutesToClose,
} from '@/features/load-priority/urgency';
import { formatDateUS } from '@/lib/utils/date';
import type { LoadPriorityEntry, LoadPriorityBoard } from '@/types/domain';

const LP_TABLES = ['load_priority_boards', 'load_priority_entries'] as const;

/** Zone accent colors — mid-tones that read on both light and dark surfaces. */
const ZONE_PALETTE = ['#4F8FE8', '#B07CE0', '#2FC7B0', '#E8944F', '#E85F8F'];
function zoneColor(zone: number): string {
  return ZONE_PALETTE[(zone - 1) % ZONE_PALETTE.length] ?? ZONE_PALETTE[0]!;
}

type QueueStatus = 'OPEN' | 'LOADING' | 'CLOSED';
const STATUS_COLOR: Record<QueueStatus, string> = {
  OPEN: '#10B981',
  LOADING: '#F59E0B',
  CLOSED: '#6B7280',
};

/** LOADING when a door cuts within 30 min; CLOSED tracks the real closed flag. */
function queueStatus(entry: LoadPriorityEntry, now: Date | null): QueueStatus {
  if (entry.status === 'closed') return 'CLOSED';
  if (!now) return 'OPEN';
  const mins = minutesToClose(entry.closeTime, now);
  if (mins === null) return 'OPEN';
  return mins <= 30 ? 'LOADING' : 'OPEN';
}

function countdown(entry: LoadPriorityEntry, now: Date | null): string {
  if (entry.status === 'closed') return 'closed';
  if (!now) return '';
  const mins = minutesToClose(entry.closeTime, now);
  if (mins === null) return '';
  if (mins <= 0) return 'now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

const laneOrCarrier = (e: LoadPriorityEntry) =>
  e.carrierLabelSnapshot ?? e.laneNumberSnapshot;

/**
 * Load Priority TV — a single, distance-readable priority queue (per the
 * docs/priority-queue.jsx reference). All doors are sorted by close time, with a
 * "Next Up" hero, zone filter pills, per-row status pill + live countdown.
 * Theme-aware: surfaces/text use semantic tokens; zone/status accents are fixed
 * colors that read in both light and dark. Realtime + a clock tick keep it live.
 */
export function LpTvScreen({
  board,
  entries,
  shiftKeyName,
}: {
  board: LoadPriorityBoard | null;
  entries: LoadPriorityEntry[];
  shiftKeyName: string;
}) {
  useRealtimeRefresh('load-priority-tv', LP_TABLES);

  // `now` starts null so SSR + first client render match (no hydration drift).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const immediate = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(t);
    };
  }, []);

  const [filter, setFilter] = useState<number | 'ALL'>('ALL');

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          (a.closeTime ?? '99:99').localeCompare(b.closeTime ?? '99:99') ||
          a.doorNumber.localeCompare(b.doorNumber),
      ),
    [entries],
  );
  const zonesPresent = useMemo(
    () => [...new Set(entries.map((e) => e.zone))].sort((a, b) => a - b),
    [entries],
  );
  const list =
    filter === 'ALL' ? sorted : sorted.filter((e) => e.zone === filter);
  // Next Up follows the selected zone filter (all zones → the global next up).
  const nextUp = list.find((e) => e.status !== 'closed');

  const nowText = now
    ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div className="tv-stage relative min-h-screen overflow-auto px-4 py-5 md:px-8">
      <TvBackground />
      <div className="relative z-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h1 className="text-foreground text-2xl font-extrabold sm:text-3xl">
            Load Priority Queue
          </h1>
          <span className="text-foreground-subtle text-sm font-medium">
            {board ? `${shiftKeyName} · ${formatDateUS(board.boardDate)}` : ''}
            {nowText ? ` · now ${nowText}` : ''}
          </span>
        </div>

        <div className="tv-card rounded-2xl p-4 sm:p-6">
          {!board || entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-foreground text-2xl font-bold sm:text-3xl">
                No published Load Priority Board is available.
              </p>
              <p className="text-foreground-muted mt-2 text-base sm:text-lg">
                A published board appears here once a leader publishes one.
              </p>
            </div>
          ) : (
            <>
              {nextUp ? (
                <div
                  className="mb-6 flex items-center justify-between gap-4 rounded-2xl p-5"
                  style={{
                    background: `linear-gradient(135deg, ${zoneColor(nextUp.zone)}22, ${zoneColor(nextUp.zone)}08)`,
                    border: `1px solid ${zoneColor(nextUp.zone)}55`,
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="mb-1 text-xs font-bold tracking-wider uppercase"
                      style={{ color: zoneColor(nextUp.zone) }}
                    >
                      Next Up · Zone {nextUp.zone}
                    </div>
                    <div className="text-foreground text-3xl font-extrabold">
                      Door {nextUp.doorNumber}
                    </div>
                    <div className="text-foreground-muted text-sm font-medium">
                      {laneOrCarrier(nextUp)
                        ? `(${laneOrCarrier(nextUp)}) · `
                        : ''}
                      cuts {formatCloseTime(nextUp.closeTime)}
                    </div>
                  </div>
                  <div
                    className="shrink-0 text-right text-2xl font-extrabold tabular-nums"
                    style={{ color: zoneColor(nextUp.zone) }}
                  >
                    {countdown(nextUp, now)}
                  </div>
                </div>
              ) : null}

              <div className="mb-4 flex flex-wrap gap-2">
                {(['ALL', ...zonesPresent] as (number | 'ALL')[]).map((z) => {
                  const active = filter === z;
                  return (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setFilter(z)}
                      className={
                        active
                          ? 'bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-bold tracking-wide uppercase'
                          : 'bg-surface-raised text-foreground-muted hover:text-foreground rounded-full px-3 py-1.5 text-xs font-bold tracking-wide uppercase'
                      }
                    >
                      {z === 'ALL' ? 'All Zones' : `Zone ${z}`}
                    </button>
                  );
                })}
              </div>

              <div className="divide-border divide-y">
                {list.map((entry) => {
                  const status = queueStatus(entry, now);
                  const tag = laneOrCarrier(entry);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 py-3 pl-3"
                      style={{
                        borderLeft: `3px solid ${zoneColor(entry.zone)}`,
                      }}
                    >
                      <div className="text-foreground w-[70px] shrink-0 text-sm font-bold sm:text-base">
                        {formatCloseTime(entry.closeTime)}
                      </div>
                      <div className="min-w-0 flex-1 text-sm sm:text-base">
                        <span className="text-foreground font-bold">
                          Door {entry.doorNumber}
                        </span>
                        {tag ? (
                          <span className="text-foreground-subtle">
                            {' '}
                            ({tag})
                          </span>
                        ) : null}
                      </div>
                      <span
                        className="hidden text-[11px] font-bold uppercase sm:inline"
                        style={{ color: zoneColor(entry.zone) }}
                      >
                        Zone {entry.zone}
                      </span>
                      <span
                        className="rounded-full px-2 py-1 text-[10px] font-bold uppercase"
                        style={{
                          background: `${STATUS_COLOR[status]}1A`,
                          color: STATUS_COLOR[status],
                        }}
                      >
                        {status}
                      </span>
                      <span className="text-foreground-subtle w-[72px] shrink-0 text-right text-xs font-medium tabular-nums">
                        {countdown(entry, now)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
