'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
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
  deleteTask,
  setTaskActive,
  updateTask,
} from '@/features/config/actions';
import { DEPARTMENT_KIND_LABELS } from '@/lib/constants/departments';
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
  const [deleting, setDeleting] = useState<TaskType | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'inbound' | 'outbound'>(
    'all',
  );
  const [pending, setPending] = useState(false);

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const deptKind = useMemo(
    () => new Map(departments.map((d) => [d.id, d.kind])),
    [departments],
  );
  const filteredItems = useMemo(
    () =>
      kindFilter === 'all'
        ? items
        : items.filter((i) => deptKind.get(i.departmentId) === kindFilter),
    [items, kindFilter, deptKind],
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
      needsDockDoor: false,
      usesUph: true,
      avgUnitsPerHour: '',
      sortOrder: 0,
      active: true,
    }),
    [departments],
  );

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: blank,
  });
  const usesUph = useWatch({ control: form.control, name: 'usesUph' });

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
      needsDockDoor: item.needsDockDoor,
      usesUph: item.usesUph,
      avgUnitsPerHour:
        item.avgUnitsPerHour === null ? '' : String(item.avgUnitsPerHour),
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

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const result = await deleteTask(deleting.id);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Task deleted' });
      setDeleting(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not delete',
        description: result.error,
        variant: 'error',
      });
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Field label="Show" htmlFor="task-kind-filter">
          <Select
            id="task-kind-filter"
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as 'all' | 'inbound' | 'outbound')
            }
          >
            <option value="all">All departments</option>
            <option value="inbound">{DEPARTMENT_KIND_LABELS.inbound}</option>
            <option value="outbound">{DEPARTMENT_KIND_LABELS.outbound}</option>
          </Select>
        </Field>
      </div>
      <ConfigList
        items={filteredItems}
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
          {
            header: 'Dock door',
            cell: (i) => (i.needsDockDoor ? 'Per door' : '—'),
          },
          {
            header: 'UPH',
            cell: (i) =>
              !i.usesUph ? (
                <span className="text-foreground-subtle">Off</span>
              ) : i.avgUnitsPerHour === null ? (
                <span className="text-warning font-medium">Not configured</span>
              ) : (
                <span className="tabular-nums">{i.avgUnitsPerHour}</span>
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
            onDelete={() => setDeleting(i)}
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
            id="task-needs-door"
            label="Staffed per dock door (inbound unload)"
            {...form.register('needsDockDoor')}
          />
          <p className="text-foreground-subtle -mt-2 text-xs">
            When on, this task is staffed from the plan&apos;s active dock doors
            — one position per door — instead of a people count.
          </p>
          <Checkbox
            id="task-uses-uph"
            label="Use UPH labor calculator"
            {...form.register('usesUph')}
          />
          <Field
            label="Avg units per hour (UPH)"
            htmlFor="task-uph"
            error={form.formState.errors.avgUnitsPerHour?.message}
          >
            <Input
              id="task-uph"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 18 — leave blank if not yet set"
              disabled={!usesUph}
              {...form.register('avgUnitsPerHour')}
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

      <ConfirmDialog
        open={!!deleting}
        title="Delete task?"
        description="This permanently removes the task. If it is used in any template, plan, or history, deletion is blocked — deactivate instead to preserve historical reporting."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
