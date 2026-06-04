'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Input,
  Modal,
  useToast,
} from '@/components/ui';
import { ConfigList } from './config-list';
import { Field } from './field';
import { RowActions, StatusCell } from './row-actions';
import {
  dockDoorSchema,
  type DockDoorFormValues,
} from '@/features/config/schemas';
import {
  createDockDoor,
  setDockDoorActive,
  updateDockDoor,
} from '@/features/config/actions';
import type { DockDoor } from '@/types/domain';

const BLANK: DockDoorFormValues = {
  doorNumber: '',
  notes: '',
  sortOrder: 0,
  active: true,
};

export function DockDoorManager({ items }: { items: DockDoor[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DockDoor | null>(null);
  const [toggling, setToggling] = useState<DockDoor | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<DockDoorFormValues>({
    resolver: zodResolver(dockDoorSchema),
    defaultValues: BLANK,
  });

  function openCreate() {
    setEditing(null);
    form.reset(BLANK);
    setOpen(true);
  }

  function openEdit(item: DockDoor) {
    setEditing(item);
    form.reset({
      doorNumber: item.doorNumber,
      notes: item.notes ?? '',
      sortOrder: item.sortOrder,
      active: item.active,
    });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateDockDoor(editing.id, values)
      : await createDockDoor(values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Dock door updated' : 'Dock door added' });
      setOpen(false);
      router.refresh();
    } else {
      toast({
        title: 'Could not save',
        description: result.error,
        variant: 'error',
      });
    }
  });

  async function confirmToggle() {
    if (!toggling) return;
    setPending(true);
    const result = await setDockDoorActive(toggling.id, !toggling.active);
    setPending(false);
    if (result.ok) {
      toast({ title: toggling.active ? 'Deactivated' : 'Activated' });
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

  return (
    <>
      <ConfigList
        items={items}
        getKey={(i) => i.id}
        searchText={(i) => `${i.doorNumber} ${i.notes ?? ''}`}
        isActive={(i) => i.active}
        searchPlaceholder="Search dock doors…"
        addLabel="Add dock door"
        onAdd={openCreate}
        emptyTitle="No dock doors yet"
        emptyDescription="Add dock doors like 635, 622, or 618."
        columns={[
          {
            header: 'Door',
            cell: (i) => <span className="font-medium">{i.doorNumber}</span>,
          },
          {
            header: 'Notes',
            cell: (i) => (
              <span className="text-foreground-muted">{i.notes ?? '—'}</span>
            ),
          },
          { header: 'Order', cell: (i) => i.sortOrder },
          { header: 'Status', cell: (i) => <StatusCell active={i.active} /> },
        ]}
        renderActions={(i) => (
          <RowActions
            active={i.active}
            onEdit={() => openEdit(i)}
            onToggle={() => setToggling(i)}
          />
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit dock door' : 'Add dock door'}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={submit}>
          <Field
            label="Door number"
            htmlFor="door-number"
            error={form.formState.errors.doorNumber?.message}
          >
            <Input
              id="door-number"
              {...form.register('doorNumber')}
              placeholder="e.g. 635"
            />
          </Field>
          <Field
            label="Sort order"
            htmlFor="door-sort"
            error={form.formState.errors.sortOrder?.message}
          >
            <Input
              id="door-sort"
              type="number"
              {...form.register('sortOrder', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Notes"
            htmlFor="door-notes"
            error={form.formState.errors.notes?.message}
          >
            <Input
              id="door-notes"
              {...form.register('notes')}
              placeholder="Optional"
            />
          </Field>
          <Checkbox
            id="door-active"
            label="Active"
            {...form.register('active')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={
          toggling?.active ? 'Deactivate dock door?' : 'Activate dock door?'
        }
        description={
          toggling?.active
            ? 'It will not be available for inbound planning. History is preserved.'
            : 'It will become selectable again.'
        }
        confirmLabel={toggling?.active ? 'Deactivate' : 'Activate'}
        destructive={toggling?.active ?? false}
        pending={pending}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}
