'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Pencil, Power, PowerOff } from 'lucide-react';
import { ConfirmDialog, useToast } from '@/components/ui';
import { ConfigList } from '@/components/config/config-list';
import { StatusCell } from '@/components/config/row-actions';
import {
  duplicateTemplate,
  setTemplateActive,
} from '@/features/templates/actions';
import type { Department, PlanTemplate, ShiftKey } from '@/types/domain';

interface TemplateManagerProps {
  items: PlanTemplate[];
  departments: Department[];
  shiftKeys: ShiftKey[];
}

/**
 * Templates list (Phase 4): search + active/inactive filter, with Edit (opens
 * the dedicated editor page), Duplicate, and Archive/Activate per row. Editing
 * a template's contents happens on `/templates/[id]`, not in a modal — only the
 * Duplicate and Archive confirmations use modals here.
 */
export function TemplateManager({
  items,
  departments,
  shiftKeys,
}: TemplateManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [toggling, setToggling] = useState<PlanTemplate | null>(null);
  const [duplicating, setDuplicating] = useState<PlanTemplate | null>(null);
  const [pending, setPending] = useState(false);

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const keyName = useMemo(
    () => new Map(shiftKeys.map((k) => [k.id, k.name])),
    [shiftKeys],
  );

  async function confirmToggle() {
    if (!toggling) return;
    setPending(true);
    const result = await setTemplateActive(toggling.id, !toggling.active);
    setPending(false);
    if (result.ok) {
      toast({
        title: toggling.active ? 'Template archived' : 'Template activated',
      });
      setToggling(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not update',
        description: result.error,
        variant: 'error',
      });
    }
  }

  async function confirmDuplicate() {
    if (!duplicating) return;
    setPending(true);
    const result = await duplicateTemplate(duplicating.id);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Template duplicated' });
      setDuplicating(null);
      router.push(`/templates/${result.id}`);
    } else {
      toast({
        title: 'Could not duplicate',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <>
      <ConfigList
        items={items}
        getKey={(i) => i.id}
        searchText={(i) =>
          `${i.name} ${deptName.get(i.departmentId) ?? ''} ${keyName.get(i.shiftKeyId) ?? ''}`
        }
        isActive={(i) => i.active}
        searchPlaceholder="Search templates…"
        addLabel="Add template"
        onAdd={() => router.push('/templates/new')}
        emptyTitle="No templates yet"
        emptyDescription="Create a reusable plan like “Key 1 Outbound” so leaders don't start from zero."
        columns={[
          {
            header: 'Name',
            cell: (i) => <span className="font-medium">{i.name}</span>,
          },
          {
            header: 'Department',
            cell: (i) => deptName.get(i.departmentId) ?? '—',
          },
          {
            header: 'Shift key',
            cell: (i) => keyName.get(i.shiftKeyId) ?? '—',
          },
          { header: 'Status', cell: (i) => <StatusCell active={i.active} /> },
        ]}
        renderActions={(i) => (
          <>
            <button
              type="button"
              onClick={() => router.push(`/templates/${i.id}`)}
              className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2"
              aria-label="Edit template"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setDuplicating(i)}
              className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2"
              aria-label="Duplicate template"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setToggling(i)}
              className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2"
              aria-label={i.active ? 'Archive template' : 'Activate template'}
            >
              {i.active ? (
                <PowerOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Power className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={!!duplicating}
        title="Duplicate template?"
        description={`A copy of “${duplicating?.name}” and all its items will be created. You'll be taken to the new copy to edit it.`}
        confirmLabel="Duplicate"
        destructive={false}
        pending={pending}
        onConfirm={confirmDuplicate}
        onCancel={() => setDuplicating(null)}
      />

      <ConfirmDialog
        open={!!toggling}
        title={toggling?.active ? 'Archive template?' : 'Activate template?'}
        description={
          toggling?.active
            ? 'It will be hidden from new plans. Its history is preserved.'
            : 'It will become selectable again.'
        }
        confirmLabel={toggling?.active ? 'Archive' : 'Activate'}
        destructive={toggling?.active ?? false}
        pending={pending}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}
