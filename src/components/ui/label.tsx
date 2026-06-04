import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'text-foreground-muted text-sm font-medium',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
