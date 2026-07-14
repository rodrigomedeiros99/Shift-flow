'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
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

type StatusFilter = 'all' | 'active' | 'inactive';
type SortValue = 'name-asc' | 'name-desc' | 'dept' | 'key';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'dept', label: 'Department' },
  { value: 'key', label: 'Key' },
];

const PAGE_SIZES = [25, 50, 100] as const;
const STORAGE_KEY = 'shiftflow:associates:filters:v1';

/**
 * Departments omitted from the Quick Statistics cards (matched by name,
 * case-insensitive). They still count toward Total/Inactive and remain
 * selectable in the Department filter.
 */
const STAT_HIDDEN_DEPARTMENTS = ['support', 'transportation'];

const fullName = (a: Associate) => `${a.firstName} ${a.lastName}`;
const sortKey = (a: Associate) => `${a.lastName} ${a.firstName}`;
const byName = (a: Associate, b: Associate) =>
  sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: 'base' });

/** Persisted filter/sort state (per session, per the "remember filters" ask). */
interface Persisted {
  query: string;
  dept: string;
  key: string;
  status: StatusFilter;
  equip: string;
  sort: SortValue;
  pageSize: number;
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
  const [pending, setPending] = useState(false);

  // --- Toolbar state (search / filters / sort / paging) ---
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [keyFilter, setKeyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [equipFilter, setEquipFilter] = useState('all'); // 'all' | 'none' | id
  const [sort, setSort] = useState<SortValue>('name-asc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  // Restore last session's filters (deferred so it stays SSR-safe and never
  // sets state synchronously inside the effect).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw) as Partial<Persisted>;
          const validDept =
            s.dept && departments.some((d) => d.id === s.dept) ? s.dept : 'all';
          const validKey =
            s.key && shiftKeys.some((k) => k.id === s.key) ? s.key : 'all';
          const validEquip =
            s.equip === 'none' ||
            (s.equip && equipment.some((e) => e.id === s.equip))
              ? s.equip
              : 'all';
          setQuery(s.query ?? '');
          setDeptFilter(validDept);
          setKeyFilter(validKey);
          setStatusFilter(s.status ?? 'all');
          setEquipFilter(validEquip ?? 'all');
          if (s.sort) setSort(s.sort);
          if (s.pageSize && PAGE_SIZES.includes(s.pageSize as 25 | 50 | 100))
            setPageSize(s.pageSize);
        }
      } catch {
        // ignore malformed storage
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [departments, shiftKeys, equipment]);

  // Persist on change (writes storage only — no setState).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: Persisted = {
        query,
        dept: deptFilter,
        key: keyFilter,
        status: statusFilter,
        equip: equipFilter,
        sort,
        pageSize,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable — ignore
    }
  }, [
    hydrated,
    query,
    deptFilter,
    keyFilter,
    statusFilter,
    equipFilter,
    sort,
    pageSize,
  ]);

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const keyName = useMemo(
    () => new Map(shiftKeys.map((k) => [k.id, k.name])),
    [shiftKeys],
  );

  // Base scope = search + department + key + equipment (NOT status), so the
  // Active/Inactive stat cards stay meaningful while status is being filtered.
  const baseItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (deptFilter !== 'all' && i.departmentId !== deptFilter) return false;
      if (keyFilter !== 'all' && i.defaultKeyId !== keyFilter) return false;
      if (equipFilter !== 'all') {
        const certs = certifications[i.id] ?? [];
        if (
          equipFilter === 'none'
            ? certs.length > 0
            : !certs.includes(equipFilter)
        )
          return false;
      }
      if (
        q &&
        !`${fullName(i)} ${i.employeeId ?? ''}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, query, deptFilter, keyFilter, equipFilter, certifications]);

  // Table set = base + status filter, then sorted.
  const sorted = useMemo(() => {
    const rows = baseItems.filter((i) =>
      statusFilter === 'all' ? true : i.active === (statusFilter === 'active'),
    );
    const cmp: Record<SortValue, (a: Associate, b: Associate) => number> = {
      'name-asc': byName,
      'name-desc': (a, b) => byName(b, a),
      dept: (a, b) =>
        (deptName.get(a.departmentId) ?? '').localeCompare(
          deptName.get(b.departmentId) ?? '',
        ) || byName(a, b),
      key: (a, b) =>
        (keyName.get(a.defaultKeyId) ?? '').localeCompare(
          keyName.get(b.defaultKeyId) ?? '',
        ) || byName(a, b),
    };
    return [...rows].sort(cmp[sort]);
  }, [baseItems, statusFilter, sort, deptName, keyName]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const rangeFrom = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeTo = Math.min(safePage * pageSize, sorted.length);

  // Any filter/search/sort change returns to page 1.
  function onFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  // Stat cards — recompute from the (status-independent) base scope.
  const activeCount = useMemo(
    () => baseItems.filter((i) => i.active).length,
    [baseItems],
  );
  const statCards = useMemo(() => {
    const inactive = baseItems.length - activeCount;
    if (deptFilter === 'all') {
      return [
        { label: 'Total', value: baseItems.length },
        ...departments
          .filter(
            (d) =>
              !STAT_HIDDEN_DEPARTMENTS.includes(d.name.trim().toLowerCase()),
          )
          .map((d) => ({
            label: d.name,
            value: baseItems.filter((i) => i.departmentId === d.id).length,
          })),
        { label: 'Inactive', value: inactive },
      ];
    }
    return [
      { label: 'Total', value: baseItems.length },
      { label: 'Active', value: activeCount },
      { label: 'Inactive', value: inactive },
    ];
  }, [baseItems, activeCount, deptFilter, departments]);

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
      {/* Quick statistics — reflect the active filters (status-independent). */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {statCards.map((stat) => (
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

      {/* Toolbar: search + filters + sort + add */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field
          label="Search"
          htmlFor="assoc-search"
          className="min-w-56 flex-1"
        >
          <div className="relative">
            <Search
              className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="assoc-search"
              value={query}
              onChange={(e) => onFilter(setQuery)(e.target.value)}
              placeholder="Search name or employee ID…"
              className="pl-9"
            />
          </div>
        </Field>
        <Field label="Department" htmlFor="assoc-dept-filter">
          <Select
            id="assoc-dept-filter"
            value={deptFilter}
            onChange={(e) => onFilter(setDeptFilter)(e.target.value)}
            className="sm:w-44"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Key" htmlFor="assoc-key-filter">
          <Select
            id="assoc-key-filter"
            value={keyFilter}
            onChange={(e) => onFilter(setKeyFilter)(e.target.value)}
            className="sm:w-36"
          >
            <option value="all">All keys</option>
            {shiftKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="assoc-status-filter">
          <Select
            id="assoc-status-filter"
            value={statusFilter}
            onChange={(e) =>
              onFilter(setStatusFilter)(e.target.value as StatusFilter)
            }
            className="sm:w-36"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Certification" htmlFor="assoc-equip-filter">
          <Select
            id="assoc-equip-filter"
            value={equipFilter}
            onChange={(e) => onFilter(setEquipFilter)(e.target.value)}
            className="sm:w-40"
          >
            <option value="all">All certifications</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
            <option value="none">None</option>
          </Select>
        </Field>
        <Field label="Sort by" htmlFor="assoc-sort">
          <Select
            id="assoc-sort"
            value={sort}
            onChange={(e) => onFilter(setSort)(e.target.value as SortValue)}
            className="sm:w-40"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={openCreate} className="ml-auto gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add associate
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No associates yet' : 'No matches'}
          description={
            items.length === 0
              ? 'Add associates and assign their department, default key, and certifications.'
              : 'Try adjusting your search or filters.'
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-border bg-surface-raised/50 border-b">
                <tr>
                  {[
                    'Name',
                    'Employee ID',
                    'Department',
                    'Default key',
                    'Certifications',
                    'Status',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-foreground-muted px-4 py-3 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="text-foreground-muted px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((i) => {
                  const count = certifications[i.id]?.length ?? 0;
                  return (
                    <tr
                      key={i.id}
                      className="border-border hover:bg-surface-raised/30 border-b last:border-0"
                    >
                      <td className="text-foreground px-4 py-3 font-medium">
                        {i.lastName}, {i.firstName}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        {i.employeeId ?? '—'}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        {deptName.get(i.departmentId) ?? '—'}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        {keyName.get(i.defaultKeyId) ?? '—'}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        {count > 0 ? (
                          <Badge tone="info">{count}</Badge>
                        ) : (
                          <span className="text-foreground-subtle">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusCell active={i.active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <RowActions
                            active={i.active}
                            onEdit={() => openEdit(i)}
                            onToggle={() => setToggling(i)}
                            onDelete={() => setDeleting(i)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-foreground-muted text-sm">
              Showing {rangeFrom}–{rangeTo} of {sorted.length}
            </p>
            <div className="flex items-center gap-3">
              <label className="text-foreground-muted flex items-center gap-2 text-sm">
                Per page
                <Select
                  value={String(pageSize)}
                  onChange={(e) =>
                    onFilter(setPageSize)(Number(e.target.value))
                  }
                  aria-label="Rows per page"
                  className="w-20"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-foreground-muted px-2 text-sm tabular-nums">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
