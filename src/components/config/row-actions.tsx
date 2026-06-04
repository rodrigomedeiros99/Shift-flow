'use client';

import { Pencil, Power, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui';

/** Active/Inactive status badge used in every config table. */
export function StatusCell({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

/** Edit + activate/deactivate controls for a config table row. */
export function RowActions({
  active,
  onEdit,
  onToggle,
}: {
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2"
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2"
        aria-label={active ? 'Deactivate' : 'Activate'}
      >
        {active ? (
          <PowerOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Power className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
