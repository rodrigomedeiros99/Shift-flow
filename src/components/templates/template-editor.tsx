'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  templateItemSchema,
  type TemplateItemFormValues,
} from '@/features/templates/schemas';
import {
  createTemplateItem,
  deleteTemplateItem,
  moveTemplateItem,
  updateTemplateItem,
} from '@/features/templates/actions';
import { TemplateForm } from './template-form';
import type {
  Department,
  DockDoor,
  EquipmentType,
  PlanTemplate,
  ShiftKey,
  TaskType,
  TemplateItem,
} from '@/types/domain';

interface TemplateEditorProps {
  template: PlanTemplate;
  items: TemplateItem[];
  departments: Department[];
  shiftKeys: ShiftKey[];
  tasks: TaskType[];
  equipment: EquipmentType[];
  dockDoors: DockDoor[];
}

const blankItem: TemplateItemFormValues = {
  taskTypeId: '',
  dockDoorId: '',
  defaultEquipmentId: '',
  peopleNeeded: 1,
  perActiveDoor: false,
  notes: '',
};

/**
 * Dedicated template editor (`/templates/[id]`): edit the header inline, then
 * manage line items. Per the editor/modal convention, only single-item
 * add/edit and the delete confirmation use modals — the editor itself is a page.
 */
export function TemplateEditor({
  template,
  items,
  departments,
  shiftKeys,
  tasks,
  equipment,
  dockDoors,
}: TemplateEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateItem | null>(null);
  const [deleting, setDeleting] = useState<TemplateItem | null>(null);
  const [pending, setPending] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const taskName = useMemo(
    () => new Map(tasks.map((t) => [t.id, t.name])),
    [tasks],
  );
  const equipName = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment],
  );
  const doorName = useMemo(
    () => new Map(dockDoors.map((d) => [d.id, d.doorNumber])),
    [dockDoors],
  );

  const form = useForm<TemplateItemFormValues>({
    resolver: zodResolver(templateItemSchema),
    defaultValues: blankItem,
  });

  function openCreate() {
    setEditing(null);
    form.reset(blankItem);
    setOpen(true);
  }

  function openEdit(item: TemplateItem) {
    setEditing(item);
    form.reset({
      taskTypeId: item.taskTypeId ?? '',
      dockDoorId: item.dockDoorId ?? '',
      defaultEquipmentId: item.defaultEquipmentId ?? '',
      peopleNeeded: item.peopleNeeded,
      perActiveDoor: item.perActiveDoor,
      notes: item.notes ?? '',
    });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateTemplateItem(editing.id, template.id, values)
      : await createTemplateItem(template.id, values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Item updated' : 'Item added' });
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

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const result = await deleteTemplateItem(deleting.id, template.id);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Item removed' });
      setDeleting(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not remove',
        description: result.error,
        variant: 'error',
      });
    }
  }

  async function move(item: TemplateItem, direction: 'up' | 'down') {
    setMovingId(item.id);
    const result = await moveTemplateItem(item.id, template.id, direction);
    setMovingId(null);
    if (result.ok) {
      router.refresh();
    } else {
      toast({
        title: 'Could not reorder',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => router.push('/templates')}
        className="text-foreground-muted hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to templates
      </button>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template details</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm
              template={template}
              departments={departments}
              shiftKeys={shiftKeys}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Line items</CardTitle>
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No items yet"
                  description="Add planned slots like “CL — Clamp — 3 people”."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="border-border bg-surface-raised/50 border-b">
                    <tr>
                      <th className="text-foreground-muted px-4 py-3 font-medium">
                        Order
                      </th>
                      <th className="text-foreground-muted px-4 py-3 font-medium">
                        Task
                      </th>
                      <th className="text-foreground-muted px-4 py-3 font-medium">
                        Equipment
                      </th>
                      <th className="text-foreground-muted px-4 py-3 font-medium">
                        Dock door
                      </th>
                      <th className="text-foreground-muted px-4 py-3 font-medium">
                        People
                      </th>
                      <th className="text-foreground-muted px-4 py-3 font-medium">
                        Notes
                      </th>
                      <th className="text-foreground-muted px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={item.id}
                        className="border-border hover:bg-surface-raised/30 border-b last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => move(item, 'up')}
                              disabled={index === 0 || movingId !== null}
                              className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-1 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Move up"
                            >
                              <ChevronUp
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(item, 'down')}
                              disabled={
                                index === items.length - 1 || movingId !== null
                              }
                              className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-1 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Move down"
                            >
                              <ChevronDown
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </td>
                        <td className="text-foreground px-4 py-3 font-medium">
                          {item.taskTypeId
                            ? (taskName.get(item.taskTypeId) ?? '—')
                            : '—'}
                        </td>
                        <td className="text-foreground px-4 py-3">
                          {item.defaultEquipmentId
                            ? (equipName.get(item.defaultEquipmentId) ?? '—')
                            : '—'}
                        </td>
                        <td className="text-foreground px-4 py-3">
                          {item.perActiveDoor ? (
                            <Badge tone="neutral">Per active door</Badge>
                          ) : item.dockDoorId ? (
                            (doorName.get(item.dockDoorId) ?? '—')
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-foreground px-4 py-3">
                          {item.peopleNeeded}
                        </td>
                        <td className="text-foreground-muted px-4 py-3">
                          {item.notes ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-2"
                              aria-label="Edit item"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(item)}
                              className="text-foreground-muted hover:bg-surface-raised hover:text-danger rounded-md p-2"
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit item' : 'Add item'}
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
            label="Task"
            htmlFor="item-task"
            error={form.formState.errors.taskTypeId?.message}
          >
            <Select id="item-task" {...form.register('taskTypeId')}>
              <option value="">Select a task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Equipment"
            htmlFor="item-equip"
            error={form.formState.errors.defaultEquipmentId?.message}
          >
            <Select id="item-equip" {...form.register('defaultEquipmentId')}>
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
            label="Dock door"
            htmlFor="item-door"
            error={form.formState.errors.dockDoorId?.message}
          >
            <Select id="item-door" {...form.register('dockDoorId')}>
              <option value="">None</option>
              {dockDoors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doorNumber}
                  {d.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-1.5">
            <Checkbox
              id="item-per-door"
              label="One per active dock door (inbound)"
              {...form.register('perActiveDoor')}
            />
            <p className="text-foreground-subtle text-xs">
              When set, this item generates one slot for each dock door the
              leader marks active that day — the fixed dock door above is
              ignored.
            </p>
          </div>

          <Field
            label="People needed"
            htmlFor="item-people"
            error={form.formState.errors.peopleNeeded?.message}
          >
            <Input
              id="item-people"
              type="number"
              min={1}
              {...form.register('peopleNeeded', { valueAsNumber: true })}
            />
          </Field>

          <Field
            label="Notes"
            htmlFor="item-notes"
            error={form.formState.errors.notes?.message}
          >
            <Input
              id="item-notes"
              {...form.register('notes')}
              placeholder="Optional"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Remove item?"
        description="This line item will be removed from the template."
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
