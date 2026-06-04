'use client';

import { cn } from '@/lib/utils/cn';
import type { AssignmentStatus } from '@/lib/constants/assignments';

/** The statuses a leader sets directly on the live board (Complete is separate). */
const SETTABLE: {
  value: 'active' | 'break' | 'lunch' | 'available';
  label: string;
}[] = [
  { value: 'active', label: 'Active' },
  { value: 'break', label: 'Break' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'available', label: 'Avail' },
];

/** Compact status pills for a live assignment card. */
export function StatusMenu({
  status,
  pending,
  onSet,
}: {
  status: AssignmentStatus;
  pending: boolean;
  onSet: (status: 'active' | 'break' | 'lunch' | 'available') => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {SETTABLE.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={pending}
          onClick={() => onSet(s.value)}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50',
            status === s.value
              ? 'bg-primary text-primary-foreground'
              : 'border-border text-foreground-muted hover:bg-surface-raised border',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
