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
  equipmentSchema,
  type EquipmentFormValues,
} from '@/features/config/schemas';
import {
  createEquipment,
  setEquipmentActive,
  updateEquipment,
} from '@/features/config/actions';
import { Badge } from '@/components/ui';
import type { EquipmentType } from '@/types/domain';

const BLANK: EquipmentFormValues = {
  name: '',
  certificationRequired: true,
  active: true,
};

export function EquipmentManager({ items }: { items: EquipmentType[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentType | null>(null);
  const [toggling, setToggling] = useState<EquipmentType | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: BLANK,
  });

  function openCreate() {
    setEditing(null);
    form.reset(BLANK);
    setOpen(true);
  }

  function openEdit(item: EquipmentType) {
    setEditing(item);
    form.reset({
      name: item.name,
      certificationRequired: item.certificationRequired,
      active: item.active,
    });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateEquipment(editing.id, values)
      : await createEquipment(values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Equipment updated' : 'Equipment added' });
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
    const result = await setEquipmentActive(toggling.id, !toggling.active);
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
        searchText={(i) => i.name}
        isActive={(i) => i.active}
        searchPlaceholder="Search equipment…"
        addLabel="Add equipment"
        onAdd={openCreate}
        emptyTitle="No equipment yet"
        emptyDescription="Add equipment types like Clamp, Pacer, or EPJ."
        columns={[
          {
            header: 'Name',
            cell: (i) => <span className="font-medium">{i.name}</span>,
          },
          {
            header: 'Certification',
            cell: (i) => (
              <Badge tone={i.certificationRequired ? 'info' : 'neutral'}>
                {i.certificationRequired ? 'Required' : 'Not required'}
              </Badge>
            ),
          },
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
        title={editing ? 'Edit equipment' : 'Add equipment'}
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
            htmlFor="equipment-name"
            error={form.formState.errors.name?.message}
          >
            <Input
              id="equipment-name"
              {...form.register('name')}
              placeholder="e.g. Clamp"
            />
          </Field>
          <Checkbox
            id="equipment-cert"
            label="Requires certification to operate"
            {...form.register('certificationRequired')}
          />
          <Checkbox
            id="equipment-active"
            label="Active"
            {...form.register('active')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={
          toggling?.active ? 'Deactivate equipment?' : 'Activate equipment?'
        }
        description={
          toggling?.active
            ? 'It will no longer be selectable in new plans. Existing history is preserved.'
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
