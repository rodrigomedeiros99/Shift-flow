'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Maximize, Minimize, Monitor, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type TvView = 'full' | 'outbound' | 'inbound';

const VIEWS: { value: TvView; label: string }[] = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'full', label: 'Full View' },
];

/**
 * TV control bar: switch view (Outbound / Inbound / Full), go fullscreen, and
 * enter Present mode (hides the chrome for huddles). State lives in the URL so a
 * view is shareable/bookmarkable per display. Never edits plan data (read-only).
 */
export function TvControls({
  view,
  present,
}: {
  view: TvView;
  present: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);

  if (present) {
    return (
      <button
        type="button"
        onClick={() => setParam('present', null)}
        className="text-foreground-muted hover:text-foreground hover:bg-surface fixed top-3 right-3 z-10 rounded-md p-2"
        aria-label="Exit present mode"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="TV view"
        className="border-border inline-flex overflow-hidden rounded-lg border"
      >
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setParam('view', v.value)}
            className={cn(
              'px-5 py-2.5 text-lg font-medium transition-colors',
              v.value === view
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground-muted hover:bg-surface hover:text-foreground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setParam('present', '1')}
          className="border-border text-foreground-muted hover:bg-surface hover:text-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-lg font-medium"
        >
          <Monitor className="h-5 w-5" aria-hidden="true" />
          Present
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="border-border text-foreground-muted hover:bg-surface hover:text-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-lg font-medium"
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Maximize className="h-5 w-5" aria-hidden="true" />
          )}
          {isFullscreen ? 'Exit' : 'Fullscreen'}
        </button>
      </div>
    </div>
  );
}
