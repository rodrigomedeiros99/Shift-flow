import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Standard error state. Shows a user-friendly message only — technical details
 * and stack traces are logged server-side, never rendered (§3 Error Handling).
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border-border bg-surface flex flex-col items-center justify-center rounded-lg border px-6 py-12 text-center',
        className,
      )}
    >
      <span className="bg-danger/15 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <AlertTriangle className="text-danger h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      <p className="text-foreground-muted mt-1 max-w-sm text-sm">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
