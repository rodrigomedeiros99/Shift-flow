import { cn } from '@/lib/utils/cn';
import {
  ASSIGNMENT_STATUS_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from '@/lib/constants/assignments';

interface StatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

/**
 * Color-coded assignment status pill shared by the planning board, dashboard,
 * and TV Mode (§5 Status Indicators) so a status reads identically everywhere.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        ASSIGNMENT_STATUS_CLASSES[status],
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {ASSIGNMENT_STATUS_LABELS[status]}
    </span>
  );
}
