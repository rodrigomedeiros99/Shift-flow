import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SpinnerProps {
  className?: string;
  label?: string;
}

/**
 * Accessible loading indicator. Announces busy state to screen readers
 * (§5 Accessibility, Loading States).
 */
export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <Loader2
        aria-hidden="true"
        className={cn('text-primary h-5 w-5 animate-spin', className)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
