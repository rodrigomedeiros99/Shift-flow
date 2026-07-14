'use client';

import { useEffect, useState } from 'react';
import { TvBackground } from '@/components/tv/tv-background';
import { LpDoorCard } from './lp-door-card';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import {
  compareEntries,
  entryUrgency,
  type UrgencyLevel,
} from '@/features/load-priority/urgency';
import { formatDateUS } from '@/lib/utils/date';
import type { LoadPriorityBoard, LoadPriorityEntry } from '@/types/domain';

const LP_TABLES = ['load_priority_boards', 'load_priority_entries'] as const;

/**
 * Load Priority TV board — read-only, distance-readable, same glassmorphism as
 * Labor TV Mode. Doors group into Zone 1/2/3, open first then closed, sorted by
 * close time. Urgency colors update on a 1-minute clock tick; Supabase Realtime
 * (+ the hook's fallback poll) refreshes the data live.
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

  // Recompute urgency against the wall clock without a data change. `now` starts
  // null so the server + first client render match (no hydration mismatch).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const immediate = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(t);
    };
  }, []);
  const clock = now ?? new Date(0);

  const zones = [...new Set(entries.map((e) => e.zone))].sort((a, b) => a - b);

  return (
    <div className="tv-stage relative flex min-h-screen flex-col overflow-auto px-5 py-4 md:px-8">
      <TvBackground />
      <div className="relative z-10 flex flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="text-foreground text-2xl font-extrabold tracking-widest uppercase">
            Load Priority
          </h1>
          {board ? (
            <p className="text-foreground-subtle text-sm tracking-wider uppercase">
              {shiftKeyName} · {formatDateUS(board.boardDate)}
            </p>
          ) : null}
        </header>

        {!board || entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <p className="text-foreground text-4xl font-semibold">
              No published Load Priority Board is available.
            </p>
            <p className="text-foreground-muted mt-2 text-2xl">
              A published board appears here once a leader publishes one.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {zones.map((zone) => {
              const zoneEntries = entries
                .filter((e) => e.zone === zone)
                .sort(compareEntries);
              return (
                <section key={zone} className="flex flex-col gap-3">
                  <h2 className="text-foreground text-xl font-extrabold tracking-widest uppercase">
                    Zone {zone}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {zoneEntries.map((entry) => {
                      const level: UrgencyLevel = entryUrgency(entry, clock);
                      return (
                        <LpDoorCard
                          key={entry.id}
                          entry={entry}
                          level={level}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
