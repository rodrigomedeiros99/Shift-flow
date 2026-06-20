import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'outline';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:outline-primary',
  secondary:
    'bg-surface-raised text-foreground hover:bg-border focus-visible:outline-foreground-subtle',
  ghost:
    'bg-transparent text-foreground-muted hover:bg-surface-raised hover:text-foreground',
  danger:
    'bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-surface-raised',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

/**
 * Shared Button primitive. All actionable buttons must use this so spacing,
 * focus rings, and disabled handling stay consistent (§5 UI Consistency).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
