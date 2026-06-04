import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

/** A pulsing placeholder block for loading states (Phase 10 perceived perf). */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-raised animate-pulse rounded-md', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
