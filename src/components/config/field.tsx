import type { ReactNode } from 'react';
import { Label } from '@/components/ui';

/** Labeled form field with inline validation message (§5 Forms). */
export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}
