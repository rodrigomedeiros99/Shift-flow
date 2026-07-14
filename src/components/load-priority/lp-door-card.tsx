import { cn } from '@/lib/utils/cn';
import {
  URGENCY_BORDER,
  URGENCY_TEXT,
  doorLabel,
  formatCloseTime,
  type UrgencyLevel,
} from '@/features/load-priority/urgency';
import type { LoadPriorityEntry } from '@/types/domain';

/**
 * One door on the Load Priority TV board: a glass card with an urgency left
 * accent, the door + lane/carrier label, the close time, and a status badge.
 * Closed doors dim and show a green CLOSED badge.
 */
export function LpDoorCard({
  entry,
  level,
}: {
  entry: LoadPriorityEntry;
  level: UrgencyLevel;
}) {
  const closed = entry.status === 'closed';
  return (
    <div
      className={cn(
        'tv-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3',
        URGENCY_BORDER[level],
      )}
    >
      {/* Lead with the close time (earliest first), then the door. Dim only the
          info when closed — the badge stays fully readable. */}
      <div className={cn('min-w-0', closed && 'opacity-60')}>
        <p
          className={cn(
            'text-2xl font-extrabold tabular-nums xl:text-3xl',
            URGENCY_TEXT[level],
          )}
        >
          {formatCloseTime(entry.closeTime)}
        </p>
        <p className="text-foreground truncate text-lg font-bold tracking-wide xl:text-xl">
          {doorLabel(entry)}
        </p>
        {entry.notes ? (
          <p className="text-foreground-muted mt-0.5 truncate text-sm">
            {entry.notes}
          </p>
        ) : null}
      </div>
      {closed ? (
        <span className="lp-badge-closed shrink-0 rounded-md border px-3 py-1 text-sm font-extrabold tracking-wider uppercase">
          Closed
        </span>
      ) : (
        <span className="text-foreground-subtle shrink-0 text-sm font-bold tracking-wider uppercase">
          Open
        </span>
      )}
    </div>
  );
}
