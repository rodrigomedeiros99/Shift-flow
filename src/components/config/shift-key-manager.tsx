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
  shiftKeySchema,
  type ShiftKeyFormValues,
} from '@/features/config/schemas';
import {
  createShiftKey,
  setShiftKeyActive,
  updateShiftKey,
} from '@/features/config/actions';
import type { ShiftKey } from '@/types/domain';

const BLANK: ShiftKeyFormValues = {
  name: '',
  startTime: '08:00',
  endTime: '18:30',
  daysOfWeek: '',
  active: true,
};

export function ShiftKeyManager({ items }: { items: ShiftKey[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftKey | null>(null);
  const [toggling, setToggling] = useState<ShiftKey | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<ShiftKeyFormValues>({
    resolver: zodResolver(shiftKeySchema),
    defaultValues: BLANK,
  });

  function openCreate() {
    setEditing(null);
    form.reset(BLANK);
    setOpen(true);
  }

  function openEdit(item: ShiftKey) {
    setEditing(item);
    form.reset({
      name: item.name,
      startTime: item.startTime.slice(0, 5),
      endTime: item.endTime.slice(0, 5),
      daysOfWeek: item.daysOfWeek,
      active: item.active,
    });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateShiftKey(editing.id, values)
      : await createShiftKey(values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Shift key updated' : 'Shift key added' });
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
    const result = await setShiftKeyActive(toggling.id, !toggling.active);
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
        searchText={(i) => `${i.name} ${i.daysOfWeek}`}
        isActive={(i) => i.active}
        searchPlaceholder="Search shift keys…"
        addLabel="Add shift key"
        onAdd={openCreate}
        emptyTitle="No shift keys yet"
        emptyDescription="Add shift keys like Key 1, Key 2, or Key 3."
        columns={[
          {
            header: 'Name',
            cell: (i) => <span className="font-medium">{i.name}</span>,
          },
          {
            header: 'Hours',
            cell: (i) =>
              `${i.startTime.slice(0, 5)} – ${i.endTime.slice(0, 5)}`,
          },
          { header: 'Days', cell: (i) => i.daysOfWeek },
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
        title={editing ? 'Edit shift key' : 'Add shift key'}
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
            label="Name"
            htmlFor="key-name"
            error={form.formState.errors.name?.message}
          >
            <Input
              id="key-name"
              {...form.register('name')}
              placeholder="e.g. Key 1"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Start time"
              htmlFor="key-start"
              error={form.formState.errors.startTime?.message}
            >
              <Input
                id="key-start"
                type="time"
                {...form.register('startTime')}
              />
            </Field>
            <Field
              label="End time"
              htmlFor="key-end"
              error={form.formState.errors.endTime?.message}
            >
              <Input id="key-end" type="time" {...form.register('endTime')} />
            </Field>
          </div>
          <Field
            label="Days of week"
            htmlFor="key-days"
            error={form.formState.errors.daysOfWeek?.message}
          >
            <Input
              id="key-days"
              {...form.register('daysOfWeek')}
              placeholder="e.g. Mon-Thu"
            />
          </Field>
          <Checkbox
            id="key-active"
            label="Active"
            {...form.register('active')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={
          toggling?.active ? 'Deactivate shift key?' : 'Activate shift key?'
        }
        description={
          toggling?.active
            ? 'It will be hidden from new plan selections. History is preserved.'
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
