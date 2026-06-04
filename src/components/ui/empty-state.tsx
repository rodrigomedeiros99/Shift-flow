import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

/**
 * Standard empty state. Every list/board must render this instead of a blank
 * screen when it has no data (§5 Loading States: never show blank screens).
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border bg-surface/50 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <span className="bg-surface-raised mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="text-foreground-subtle h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      {description ? (
        <p className="text-foreground-muted mt-1 max-w-sm text-sm">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
