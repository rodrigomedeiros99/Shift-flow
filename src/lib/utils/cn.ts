import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names while resolving Tailwind utility conflicts
 * (e.g. `px-2 px-4` → `px-4`). Used by every UI primitive so callers can
 * override styles predictably.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
