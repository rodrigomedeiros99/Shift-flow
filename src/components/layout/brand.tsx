import { Boxes } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BrandProps {
  className?: string;
  /** When collapsed, hide the wordmark on desktop and show only the mark. */
  collapsed?: boolean;
}

/** ShiftFlow wordmark with the Home Depot orange accent (§5 Brand Identity). */
export function Brand({ className, collapsed = false }: BrandProps) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <Boxes className="h-5 w-5" aria-hidden="true" />
      </span>
      <span
        className={cn(
          'text-foreground text-lg font-bold tracking-tight',
          collapsed && 'lg:hidden',
        )}
      >
        Shift<span className="text-primary">Flow</span>
      </span>
    </span>
  );
}
