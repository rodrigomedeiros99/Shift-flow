import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Shared text input. Validation messaging is handled by the surrounding form
 * field (§5 Forms: validate immediately, display clear errors).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'border-border bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm',
          'placeholder:text-foreground-subtle',
          'focus-visible:border-primary focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
