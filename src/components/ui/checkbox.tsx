import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: string;
}

/** Checkbox with an inline label, usable with react-hook-form `register`. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={cn(
            'border-border bg-background text-primary accent-primary h-4 w-4 rounded focus-visible:outline-none',
            className,
          )}
          {...props}
        />
        {label}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
