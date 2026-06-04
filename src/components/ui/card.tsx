import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type DivProps = HTMLAttributes<HTMLDivElement>;

/**
 * Card surface used throughout the dashboard (§5 Card Standards).
 * Composed of Card / CardHeader / CardTitle / CardDescription / CardContent.
 */
export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'border-border bg-surface rounded-lg border shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'border-border flex flex-col gap-1 border-b p-5',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-foreground text-base font-semibold tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-foreground-muted text-sm', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn('p-5', className)} {...props} />;
}
