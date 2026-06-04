import { TvStatusDot } from './tv-status-dot';
import type { TvCard } from '@/features/tv/queries';

/**
 * One large, read-only assignment card for TV Mode. The associate name is the
 * dominant element (readable from across the floor); task / equipment / door are
 * secondary, with a color-coded status.
 */
export function TvAssignmentCard({
  card,
  showTask,
}: {
  card: TvCard;
  /** Show the task name on the card (door-grouped inbound boards need it). */
  showTask?: boolean;
}) {
  const details = [
    showTask ? card.taskName : null,
    card.equipmentName,
    card.doorNumber ? `Door ${card.doorNumber}` : null,
  ].filter((d): d is string => !!d);

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <p className="text-foreground truncate text-3xl font-semibold">
        {card.associateName}
      </p>
      {details.length > 0 ? (
        <p className="text-foreground-muted mt-1 truncate text-xl">
          {details.join(' · ')}
        </p>
      ) : null}
      <div className="mt-3">
        <TvStatusDot status={card.status} />
      </div>
    </div>
  );
}
