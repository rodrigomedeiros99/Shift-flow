'use client';

import { useSearchParams } from 'next/navigation';
import { TvControls, type TvView } from './tv-controls';
import { TvSection } from './tv-section';
import { TvBackground } from './tv-background';
import { useTvRealtime } from '@/hooks/use-tv-realtime';
import type { TvBoard, TvPlanView } from '@/features/tv/queries';

function resolveView(value: string | null): TvView {
  return value === 'outbound' || value === 'inbound' || value === 'full'
    ? value
    : 'full';
}

/** Total people on the board (group assignments + special assignments). */
function countAssigned(sections: TvPlanView[]): number {
  let total = 0;
  for (const v of sections) {
    for (const g of v.groups) total += g.cards.length;
    total += v.specials.length;
  }
  return total;
}

/**
 * TV Mode screen: read-only, distance-readable Operations Command Center of
 * today's published plans, styled as a glassmorphism wall display. View +
 * present state live in the URL; Supabase Realtime keeps it current without a
 * manual refresh. Light / Dark / System are all supported via the `.tv-*`
 * theme-aware classes.
 */
export function TvScreen({
  board,
  facilityId,
}: {
  board: TvBoard;
  facilityId: string;
}) {
  useTvRealtime(facilityId);

  const params = useSearchParams();
  const present = params.get('present') === '1';
  const view = resolveView(params.get('view'));

  const sections = [
    ...(view !== 'inbound' ? board.outbound : []),
    ...(view !== 'outbound' ? board.inbound : []),
  ];
  const total = countAssigned(sections);

  return (
    <div
      className={`tv-stage relative flex min-h-screen flex-col overflow-auto ${present ? 'px-6 py-5 md:px-10' : 'px-5 py-4 md:px-8'}`}
    >
      <TvBackground />

      <div className="relative z-10 flex flex-1 flex-col">
        <TvControls view={view} present={present} total={total} />

        <main className="mt-5 flex-1">
          {sections.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-24 text-center">
              <p className="text-foreground text-4xl font-semibold">
                No published plans for today
              </p>
              <p className="text-foreground-muted mt-2 text-2xl">
                Plans appear here once a leader publishes them.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {sections.map((v) => (
                <TvSection key={v.planId} view={v} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
