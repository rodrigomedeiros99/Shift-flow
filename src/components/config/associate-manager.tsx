'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  deleteAssociate,
  setAssociateActive,
  updateAssociate,
} from '@/features/config/actions';
import { Field as FilterField } from './field';
import { DEPARTMENT_KIND_LABELS } from '@/lib/constants/departments';
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
  const [deleting, setDeleting] = useState<Associate | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'inbound' | 'outbound'>(
    'all',
  );
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [pending, setPending] = useState(false);

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const deptKind = useMemo(
    () => new Map(departments.map((d) => [d.id, d.kind])),
    [departments],
  );
  // Scope by department kind, then by status. The counter reflects both.
  const kindItems = useMemo(
    () =>
      kindFilter === 'all'
        ? items
        : items.filter((i) => deptKind.get(i.departmentId) === kindFilter),
    [items, kindFilter, deptKind],
  );
  const filteredItems = useMemo(
    () =>
      statusFilter === 'all'
        ? kindItems
        : kindItems.filter((i) => i.active === (statusFilter === 'active')),
    [kindItems, statusFilter],
  );
  const counts = useMemo(() => {
    const active = kindItems.filter((i) => i.active).length;
    return {
      total: kindItems.length,
      active,
      inactive: kindItems.length - active,
    };
  }, [kindItems]);
  const scopeLabel =
    kindFilter === 'all'
      ? 'All Associates'
      : `${DEPARTMENT_KIND_LABELS[kindFilter]} Associates`;
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

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const result = await deleteAssociate(deleting.id);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Associate deleted' });
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
      {/* Counter — reflects the department + status filters (dashboard style). */}
      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-md">
        {[
          { label: scopeLabel, value: counts.total },
          { label: 'Active', value: counts.active },
          { label: 'Inactive', value: counts.inactive },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="px-4 py-3 text-center">
              <p className="text-foreground text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="text-foreground-muted mt-0.5 truncate text-xs">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <FilterField label="Department" htmlFor="assoc-kind-filter">
          <Select
            id="assoc-kind-filter"
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as 'all' | 'inbound' | 'outbound')
            }
            className="sm:w-44"
          >
            <option value="all">All departments</option>
            <option value="inbound">{DEPARTMENT_KIND_LABELS.inbound}</option>
            <option value="outbound">{DEPARTMENT_KIND_LABELS.outbound}</option>
          </Select>
        </FilterField>
        <FilterField label="Status" htmlFor="assoc-status-filter">
          <Select
            id="assoc-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
            }
            className="sm:w-40"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </FilterField>
      </div>
      <ConfigList
        items={filteredItems}
        hideStatusFilter
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
            onDelete={() => setDeleting(i)}
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

      <ConfirmDialog
        open={!!deleting}
        title="Delete associate?"
        description="This permanently removes the associate. If they appear in any plan or history, deletion is blocked — deactivate instead to preserve historical reporting."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
