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
  Select,
  useToast,
} from '@/components/ui';
import { ConfigList } from './config-list';
import { Field } from './field';
import { RowActions, StatusCell } from './row-actions';
import {
  departmentSchema,
  type DepartmentFormValues,
} from '@/features/config/schemas';
import {
  createDepartment,
  setDepartmentActive,
  updateDepartment,
} from '@/features/config/actions';
import {
  DEPARTMENT_KINDS,
  DEPARTMENT_KIND_LABELS,
} from '@/lib/constants/departments';
import type { Department } from '@/types/domain';

const BLANK: DepartmentFormValues = { name: '', kind: 'other', active: true };

export function DepartmentManager({ items }: { items: Department[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [toggling, setToggling] = useState<Department | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: BLANK,
  });

  function openCreate() {
    setEditing(null);
    form.reset(BLANK);
    setOpen(true);
  }

  function openEdit(item: Department) {
    setEditing(item);
    form.reset({ name: item.name, kind: item.kind, active: item.active });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateDepartment(editing.id, values)
      : await createDepartment(values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Department updated' : 'Department added' });
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
    const result = await setDepartmentActive(toggling.id, !toggling.active);
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
        searchPlaceholder="Search departments…"
        addLabel="Add department"
        onAdd={openCreate}
        emptyTitle="No departments yet"
        emptyDescription="Add departments like Inbound, Outbound, or ICQA."
        columns={[
          {
            header: 'Name',
            cell: (i) => <span className="font-medium">{i.name}</span>,
          },
          {
            header: 'Kind',
            cell: (i) => (
              <span className="text-foreground-muted">
                {DEPARTMENT_KIND_LABELS[i.kind]}
              </span>
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
        title={editing ? 'Edit department' : 'Add department'}
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
            htmlFor="dept-name"
            error={form.formState.errors.name?.message}
          >
            <Input
              id="dept-name"
              {...form.register('name')}
              placeholder="e.g. Outbound"
            />
          </Field>
          <Field
            label="Kind"
            htmlFor="dept-kind"
            error={form.formState.errors.kind?.message}
          >
            <Select id="dept-kind" {...form.register('kind')}>
              {DEPARTMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DEPARTMENT_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            id="dept-active"
            label="Active"
            {...form.register('active')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={
          toggling?.active ? 'Deactivate department?' : 'Activate department?'
        }
        description={
          toggling?.active
            ? 'It will be hidden from new selections. Existing records are preserved.'
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
