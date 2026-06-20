'use client';

import { useSearchParams } from 'next/navigation';
import { TvControls, type TvView } from './tv-controls';
import { TvSection } from './tv-section';
import { useTvRealtime } from '@/hooks/use-tv-realtime';
import type { TvBoard } from '@/features/tv/queries';

function resolveView(value: string | null): TvView {
  return value === 'outbound' || value === 'inbound' || value === 'full'
    ? value
    : 'full';
}

/**
 * TV Mode screen (Phase 8): read-only, distance-readable Operations Command
 * Center of today's published plans. View + present state live in the URL;
 * Supabase Realtime keeps it current without a manual refresh.
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

  return (
    // Large displays fill the screen with no scrolling; phones/tablets scroll
    // with a responsive layout (request: TV responsive behavior).
    <div
      className={`bg-background flex min-h-screen flex-col lg:h-screen lg:overflow-hidden ${present ? 'px-6 py-5 md:px-10' : 'px-5 py-4 md:px-8'}`}
    >
      <TvControls view={view} present={present} />

      {/* Fills the screen; scrolls only if a large shift exceeds it (never
          hides associates). */}
      <main className="mt-3 flex-1 lg:min-h-0 lg:overflow-auto">
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
          // Full view stacks Outbound (top) then Inbound (bottom), full width.
          <div className="flex min-h-full flex-col gap-5">
            {sections.map((v) => (
              <TvSection key={v.planId} view={v} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
