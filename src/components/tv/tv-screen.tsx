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
 * TV Mode screen (Phase 8): read-only, distance-readable board of today's
 * published plans. View + present state live in the URL; Supabase Realtime keeps
 * it current without a manual refresh.
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
    <div className={present ? 'px-8 py-8 md:px-14' : 'px-6 py-5 md:px-10'}>
      <TvControls view={view} present={present} />

      <main className="mt-8 space-y-14">
        {sections.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <p className="text-foreground text-4xl font-semibold">
              No published plans for today
            </p>
            <p className="text-foreground-muted mt-2 text-2xl">
              Plans appear here once a leader publishes them.
            </p>
          </div>
        ) : (
          sections.map((v) => <TvSection key={v.planId} view={v} />)
        )}
      </main>
    </div>
  );
}
