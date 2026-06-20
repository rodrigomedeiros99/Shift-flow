import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Accessible name + visible tooltip text (required for icon-only actions). */
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'danger' | 'success';
}

const toneHover = {
  default: 'hover:text-foreground',
  danger: 'hover:text-danger',
  success: 'hover:text-success',
} as const;

/**
 * Icon-only action button with a built-in hover tooltip, `aria-label`, hover
 * background, and pointer cursor — the single primitive for Edit / Switch /
 * Delete / Duplicate / Archive / Activate / Complete / Move actions (§5).
 */
export function IconButton({
  label,
  icon,
  tone = 'default',
  className,
  ...props
}: IconButtonProps) {
  return (
    <span className="group/iconbtn relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className={cn(
          'text-foreground-muted hover:bg-surface-raised cursor-pointer rounded-md p-1.5 transition-colors',
          'disabled:pointer-events-none disabled:opacity-50',
          toneHover[tone],
          className,
        )}
        {...props}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className="bg-foreground text-background pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 scale-95 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition group-hover/iconbtn:scale-100 group-hover/iconbtn:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
