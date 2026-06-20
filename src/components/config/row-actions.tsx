'use client';

import { Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { Badge, IconButton } from '@/components/ui';

/** Active/Inactive status badge used in every config table. */
export function StatusCell({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

/** Edit + activate/deactivate (+ optional delete) controls for a config row. */
export function RowActions({
  active,
  onEdit,
  onToggle,
  onDelete,
}: {
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  return (
    <>
      <IconButton
        label="Edit"
        onClick={onEdit}
        icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
      />
      <IconButton
        label={active ? 'Deactivate' : 'Activate'}
        onClick={onToggle}
        icon={
          active ? (
            <PowerOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Power className="h-4 w-4" aria-hidden="true" />
          )
        }
      />
      {onDelete ? (
        <IconButton
          label="Delete"
          tone="danger"
          onClick={onDelete}
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        />
      ) : null}
    </>
  );
}
