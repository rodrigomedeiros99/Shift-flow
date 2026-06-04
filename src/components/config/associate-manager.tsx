'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
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
  associateSchema,
  type AssociateFormValues,
} from '@/features/config/schemas';
import {
  createAssociate,
  setAssociateActive,
  updateAssociate,
} from '@/features/config/actions';
import type {
  Associate,
  Department,
  EquipmentType,
  ShiftKey,
} from '@/types/domain';

interface AssociateManagerProps {
  items: Associate[];
  departments: Department[];
  shiftKeys: ShiftKey[];
  equipment: EquipmentType[];
  certifications: Record<string, string[]>;
}

export function AssociateManager({
  items,
  departments,
  shiftKeys,
  equipment,
  certifications,
}: AssociateManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Associate | null>(null);
  const [toggling, setToggling] = useState<Associate | null>(null);
  const [pending, setPending] = useState(false);

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const keyName = useMemo(
    () => new Map(shiftKeys.map((k) => [k.id, k.name])),
    [shiftKeys],
  );

  const blank = useMemo<AssociateFormValues>(
    () => ({
      firstName: '',
      lastName: '',
      employeeId: '',
      departmentId: departments[0]?.id ?? '',
      defaultKeyId: shiftKeys[0]?.id ?? '',
      certificationIds: [],
      notes: '',
      active: true,
    }),
    [departments, shiftKeys],
  );

  const form = useForm<AssociateFormValues>({
    resolver: zodResolver(associateSchema),
    defaultValues: blank,
  });

  function openCreate() {
    setEditing(null);
    form.reset(blank);
    setOpen(true);
  }

  function openEdit(item: Associate) {
    setEditing(item);
    form.reset({
      firstName: item.firstName,
      lastName: item.lastName,
      employeeId: item.employeeId ?? '',
      departmentId: item.departmentId,
      defaultKeyId: item.defaultKeyId,
      certificationIds: certifications[item.id] ?? [],
      notes: item.notes ?? '',
      active: item.active,
    });
    setOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateAssociate(editing.id, values)
      : await createAssociate(values);
    setPending(false);
    if (result.ok) {
      toast({ title: editing ? 'Associate updated' : 'Associate added' });
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
    const result = await setAssociateActive(toggling.id, !toggling.active);
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
        searchText={(i) => `${i.firstName} ${i.lastName} ${i.employeeId ?? ''}`}
        isActive={(i) => i.active}
        searchPlaceholder="Search associates…"
        addLabel="Add associate"
        onAdd={openCreate}
        emptyTitle="No associates yet"
        emptyDescription="Add associates and assign their department, default key, and certifications."
        columns={[
          {
            header: 'Name',
            cell: (i) => (
              <span className="font-medium">
                {i.lastName}, {i.firstName}
              </span>
            ),
          },
          {
            header: 'Employee ID',
            cell: (i) => i.employeeId ?? '—',
          },
          {
            header: 'Department',
            cell: (i) => deptName.get(i.departmentId) ?? '—',
          },
          {
            header: 'Default key',
            cell: (i) => keyName.get(i.defaultKeyId) ?? '—',
          },
          {
            header: 'Certifications',
            cell: (i) => {
              const count = certifications[i.id]?.length ?? 0;
              return count > 0 ? (
                <Badge tone="info">{count}</Badge>
              ) : (
                <span className="text-foreground-subtle">None</span>
              );
            },
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
        title={editing ? 'Edit associate' : 'Add associate'}
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
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="First name"
              htmlFor="assoc-first"
              error={form.formState.errors.firstName?.message}
            >
              <Input id="assoc-first" {...form.register('firstName')} />
            </Field>
            <Field
              label="Last name"
              htmlFor="assoc-last"
              error={form.formState.errors.lastName?.message}
            >
              <Input id="assoc-last" {...form.register('lastName')} />
            </Field>
          </div>
          <Field
            label="Employee ID (optional)"
            htmlFor="assoc-emp"
            error={form.formState.errors.employeeId?.message}
          >
            <Input id="assoc-emp" {...form.register('employeeId')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Department"
              htmlFor="assoc-dept"
              error={form.formState.errors.departmentId?.message}
            >
              <Select id="assoc-dept" {...form.register('departmentId')}>
                <option value="">Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Default key"
              htmlFor="assoc-key"
              error={form.formState.errors.defaultKeyId?.message}
            >
              <Select id="assoc-key" {...form.register('defaultKeyId')}>
                <option value="">Select…</option>
                {shiftKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            <span className="text-foreground-muted text-sm font-medium">
              Certifications
            </span>
            {equipment.length === 0 ? (
              <p className="text-foreground-subtle text-sm">
                No equipment configured yet.
              </p>
            ) : (
              <div className="border-border grid grid-cols-2 gap-2 rounded-md border p-3">
                {equipment.map((e) => (
                  <Checkbox
                    key={e.id}
                    id={`cert-${e.id}`}
                    label={e.name}
                    value={e.id}
                    {...form.register('certificationIds')}
                  />
                ))}
              </div>
            )}
          </div>

          <Field
            label="Notes"
            htmlFor="assoc-notes"
            error={form.formState.errors.notes?.message}
          >
            <Input
              id="assoc-notes"
              {...form.register('notes')}
              placeholder="Optional"
            />
          </Field>
          <Checkbox
            id="assoc-active"
            label="Active"
            {...form.register('active')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={
          toggling?.active ? 'Deactivate associate?' : 'Activate associate?'
        }
        description={
          toggling?.active
            ? 'They will be excluded from new planning. History is preserved.'
            : 'They will be available for planning again.'
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
