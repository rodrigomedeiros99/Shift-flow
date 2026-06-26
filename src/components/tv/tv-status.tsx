'use client';

import { useEffect, useRef, useState } from 'react';

/** Big tabular clock (time + date) for the TV header. Client-only to avoid a
 * server/client time mismatch — fills in once mounted. */
export function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setTime(new Date());
    const immediate = setTimeout(update, 0);
    const t = setInterval(update, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="text-right leading-tight" suppressHydrationWarning>
      <div className="text-foreground text-2xl font-extrabold tracking-widest tabular-nums">
        {time
          ? time.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : '--:--:--'}
      </div>
      <div className="text-foreground-subtle text-xs tracking-wider">
        {time
          ? time
              .toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              .toUpperCase()
          : ''}
      </div>
    </div>
  );
}

/** Pulsing "LIVE · N assigned" status pill. */
export function LiveIndicator({ total }: { total: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="tv-pulse-dot inline-block h-2 w-2 rounded-full bg-green-500"
        aria-hidden="true"
      />
      <span className="text-foreground-subtle text-xs font-medium tracking-wider">
        LIVE · {total} ASSIGNED
      </span>
    </div>
  );
}

/** Animates the headcount toward `target` (counts up on mount, eases to the new
 * value on a live update). All state changes run inside the interval callback,
 * so nothing is set synchronously during the effect. */
export function AnimatedCount({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduce) {
      const id = setTimeout(() => {
        current.current = target;
        setVal(target);
      }, 0);
      return () => clearTimeout(id);
    }
    const id = setInterval(() => {
      current.current += current.current < target ? 1 : -1;
      setVal(current.current);
      if (current.current === target) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, [target]);
  return <span>{val}</span>;
}
