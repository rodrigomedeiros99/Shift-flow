import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * Whole-number stepper: `[-] value [+]`. Controlled by `value`/`onChange`, so it
 * drops into local state or react-hook-form. A 0 shows as an empty field (light
 * `0` placeholder) — this removes the leading-zero that caused "type 5 → 50",
 * and the text input (not native `number`) avoids the inconsistent browser
 * stepper. Empty parses to 0; values clamp to `[min, max]` (no negatives).
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  id,
  className,
  'aria-label': ariaLabel,
}: NumberStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => onChange(clamp(Number.isFinite(n) ? n : min));

  const btn =
    'border-border text-foreground-muted hover:bg-surface-raised hover:text-foreground flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className={cn('inline-flex items-stretch', className)}>
      <button
        type="button"
        aria-label="Decrease"
        tabIndex={-1}
        disabled={value <= min}
        onClick={() => set(value - 1)}
        className={cn(btn, 'rounded-l-md')}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value === 0 ? '' : String(value)}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          set(digits === '' ? min : Number.parseInt(digits, 10));
        }}
        className={cn(
          'border-border bg-background text-foreground h-10 w-12 border-y text-center text-sm font-medium tabular-nums',
          'placeholder:text-foreground-subtle',
          'focus-visible:border-primary focus-visible:z-10 focus-visible:outline-none',
        )}
      />
      <button
        type="button"
        aria-label="Increase"
        tabIndex={-1}
        disabled={value >= max}
        onClick={() => set(value + 1)}
        className={cn(btn, 'rounded-r-md')}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
