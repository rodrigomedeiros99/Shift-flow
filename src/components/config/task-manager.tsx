'use client';

import { useMemo, useState } from 'react';
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
import { taskSchema, type TaskFormValues } from '@/features/config/schemas';
import {
  createTask,
  setTaskActive,
  updateTask,
} from '@/features/config/actions';
import type { Department, EquipmentType, TaskType } from '@/types/domain';

interface TaskManagerProps {
  items: TaskType[];
  departments: Department[];
  equipment: EquipmentType[];
}

export function TaskManager({
  items,
  departments,
  equipment,
}: TaskManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskType | null>(null);
  const [toggling, setToggling] = useState<TaskType | null>(null);
  const [pending, setPending] = useState(false);

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const equipName = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment],
  );

  const blank = useMemo<TaskFormValues>(
    () => ({
      name: '',
      departmentId: departments[0]?.id ?? '',
      defaultEquipmentId: '',
      sortOrder: 0,
      active: true,
    }),
    [departments],
  );

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: blank,
  });

  function openCreate() {
    setEditing(null);
    form.reset(blank);
    setOpen(true);
  }

  function openEdit(item: TaskType) {
    setEditing(item);
    form.reset({
      name: item.name,
      departmentId: item.departmentId,
      defaultEquipmentId: item.defaultEquipmentId ?? '',
      sortOrder: item.sortOrder,
      active: item.active,
    });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateTask(editing.id, values)
      : await createTask(values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Task updated' : 'Task added' });
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
    const result = await setTaskActive(toggling.id, !toggling.active);
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
        searchText={(i) => `${i.name} ${deptName.get(i.departmentId) ?? ''}`}
        isActive={(i) => i.active}
        searchPlaceholder="Search tasks…"
        addLabel="Add task"
        onAdd={openCreate}
        emptyTitle="No tasks yet"
        emptyDescription="Add task types like CL, FLR, Unload, or Put Away."
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
            header: 'Default equipment',
            cell: (i) =>
              i.defaultEquipmentId
                ? (equipName.get(i.defaultEquipmentId) ?? '—')
                : '—',
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
        title={editing ? 'Edit task' : 'Add task'}
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
            htmlFor="task-name"
            error={form.formState.errors.name?.message}
          >
            <Input
              id="task-name"
              {...form.register('name')}
              placeholder="e.g. CL"
            />
          </Field>
          <Field
            label="Department"
            htmlFor="task-dept"
            error={form.formState.errors.departmentId?.message}
          >
            <Select id="task-dept" {...form.register('departmentId')}>
              <option value="">Select a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Default equipment"
            htmlFor="task-equip"
            error={form.formState.errors.defaultEquipmentId?.message}
          >
            <Select id="task-equip" {...form.register('defaultEquipmentId')}>
              <option value="">None</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Sort order"
            htmlFor="task-sort"
            error={form.formState.errors.sortOrder?.message}
          >
            <Input
              id="task-sort"
              type="number"
              {...form.register('sortOrder', { valueAsNumber: true })}
            />
          </Field>
          <Checkbox
            id="task-active"
            label="Active"
            {...form.register('active')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={toggling?.active ? 'Deactivate task?' : 'Activate task?'}
        description={
          toggling?.active
            ? 'It will be hidden from new plans. History is preserved.'
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
