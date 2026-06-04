import { cn } from '@/lib/utils/cn';
import {
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from '@/lib/constants/assignments';

/** Solid status colors (driven by the --color-status-* tokens, §5). */
const DOT_CLASS: Record<AssignmentStatus, string> = {
  assigned: 'bg-status-assigned',
  active: 'bg-status-active',
  available: 'bg-status-available',
  break: 'bg-status-break',
  lunch: 'bg-status-lunch',
  training: 'bg-status-training',
  overtime: 'bg-status-overtime',
  completed: 'bg-status-completed',
};

/** Large, distance-readable status indicator for TV cards (PRD §8). */
export function TvStatusDot({ status }: { status: AssignmentStatus }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn('h-3 w-3 shrink-0 rounded-full', DOT_CLASS[status])}
        aria-hidden="true"
      />
      <span className="text-foreground-muted text-base font-medium">
        {ASSIGNMENT_STATUS_LABELS[status]}
      </span>
    </span>
  );
}
