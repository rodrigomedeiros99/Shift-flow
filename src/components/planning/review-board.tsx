'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  ArrowLeftRight,
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
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  assignmentEditSchema,
  type AssignmentEditValues,
} from '@/features/planning/schemas';
import {
  addAssignment,
  removeAssignment,
  switchAssignments,
  updateAssignment,
} from '@/features/planning/actions';
import {
  buildRotationIndex,
  recentConflictDate,
  rotationQuality,
  scoreAssignments,
  type RotationRecord,
} from '@/features/planning/rotation';
import type {
  Assignment,
  Associate,
  CallOff,
  DockDoor,
  EquipmentType,
  SpecialAssignment,
  TaskType,
} from '@/types/domain';

interface ReviewBoardProps {
  planId: string;
  assignments: Assignment[];
  associates: Associate[];
  tasks: TaskType[];
  equipment: EquipmentType[];
  dockDoors: DockDoor[];
  callOffs: CallOff[];
  specials: SpecialAssignment[];
  /**
   * How assignment cards are grouped. Outbound is task-based; inbound groups the
   * unload work by dock door (door-less ops still group by task beneath).
   */
  groupBy?: 'task' | 'door';
  /** Planned-history rows for fair-rotation notices/score (Phase 7). */
  rotationRecords?: RotationRecord[];
  /** This plan's date — the rotation reference point. */
  planDate: string;
  /** Rotation lookback window (days) chosen in the workspace. */
  lookbackDays?: number;
  /** Published plans render the board without edit controls. */
  readOnly?: boolean;
}

const fullName = (a: Associate) => `${a.firstName} ${a.lastName}`;

export function ReviewBoard({
  planId,
  assignments,
  associates,
  tasks,
  equipment,
  dockDoors,
  callOffs,
  specials,
  groupBy = 'task',
  rotationRecords = [],
  planDate,
  lookbackDays = 1,
  readOnly = false,
}: ReviewBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const nameOf = useMemo(
    () => new Map(associates.map((a) => [a.id, fullName(a)])),
    [associates],
  );
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

  // Available pool = eligible associates not assigned and not otherwise committed.
  const pool = useMemo(() => {
    const used = new Set<string>();
    for (const a of assignments) used.add(a.associateId);
    for (const c of callOffs) used.add(c.associateId);
    for (const s of specials) {
      used.add(s.associateId);
      if (s.relatedAssociateId) used.add(s.relatedAssociateId);
    }
    return associates.filter((a) => !used.has(a.id));
  }, [assignments, associates, callOffs, specials]);

  // Group assignments into card columns. Outbound groups by task. Inbound
  // ('door') groups door-bearing work under the door, and door-less ops (Put
  // Away, Middle Mile, Support Outbound…) by task. Keys are prefixed so door
  // and task ids never collide.
  const groups = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const key =
        groupBy === 'door' && a.dockDoorId
          ? `door:${a.dockDoorId}`
          : `task:${a.taskTypeId ?? 'none'}`;
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [assignments, groupBy]);

  const groupLabel = (key: string): string => {
    if (key.startsWith('door:')) {
      return `Door ${doorName.get(key.slice(5)) ?? '—'}`;
    }
    const taskId = key.slice(5); // strip 'task:'
    return taskId === 'none'
      ? 'Unassigned task'
      : (taskName.get(taskId) ?? '—');
  };

  // --- Fair rotation (Phase 7) ---
  const rotationIndex = useMemo(
    () => buildRotationIndex(rotationRecords),
    [rotationRecords],
  );
  const rotationScore = useMemo(
    () =>
      scoreAssignments(
        assignments.map((a) => ({
          associateId: a.associateId,
          taskTypeId: a.taskTypeId,
        })),
        rotationIndex,
        planDate,
        lookbackDays,
      ),
    [assignments, rotationIndex, planDate, lookbackDays],
  );
  /** The recent-repeat date for a card, or null when rotation is fine. */
  const conflictDate = (a: Assignment): string | null =>
    recentConflictDate(
      rotationIndex,
      a.associateId,
      a.taskTypeId,
      planDate,
      lookbackDays,
    );

  // --- Edit / Add modal (shared) ---
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [adding, setAdding] = useState(false);

  const form = useForm<AssignmentEditValues>({
    resolver: zodResolver(assignmentEditSchema),
    defaultValues: {
      associateId: '',
      taskTypeId: '',
      equipmentId: '',
      dockDoorId: '',
      notes: '',
    },
  });

  function openAdd(prefillAssociateId = '') {
    setEditing(null);
    setAdding(true);
    form.reset({
      associateId: prefillAssociateId,
      taskTypeId: '',
      equipmentId: '',
      dockDoorId: '',
      notes: '',
    });
  }

  function openEdit(a: Assignment) {
    setAdding(false);
    setEditing(a);
    form.reset({
      associateId: a.associateId,
      taskTypeId: a.taskTypeId ?? '',
      equipmentId: a.equipmentId ?? '',
      dockDoorId: a.dockDoorId ?? '',
      notes: a.notes ?? '',
    });
  }

  const closeForm = () => {
    setEditing(null);
    setAdding(false);
  };

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = editing
      ? await updateAssignment(editing.id, planId, values, lookbackDays)
      : await addAssignment(planId, values, 'planned', lookbackDays);
    setPending(false);
    if (result.ok) {
      toast({
        title: editing ? 'Assignment updated' : 'Assignment added',
        description: result.warning,
        variant: result.warning ? 'info' : undefined,
      });
      closeForm();
      router.refresh();
    } else {
      toast({
        title: 'Could not save',
        description: result.error,
        variant: 'error',
      });
    }
  });

  // --- Remove ---
  const [removingItem, setRemovingItem] = useState<Assignment | null>(null);
  async function confirmRemove() {
    if (!removingItem) return;
    setPending(true);
    const result = await removeAssignment(removingItem.id, planId);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Assignment removed' });
      setRemovingItem(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not remove',
        description: result.error,
        variant: 'error',
      });
    }
  }

  // --- Switch ---
  const [switching, setSwitching] = useState<Assignment | null>(null);
  const [switchTargetId, setSwitchTargetId] = useState('');
  function openSwitch(a: Assignment) {
    setSwitching(a);
    setSwitchTargetId('');
  }
  async function confirmSwitch() {
    if (!switching || !switchTargetId) return;
    setPending(true);
    const result = await switchAssignments(
      planId,
      switching.id,
      switchTargetId,
      lookbackDays,
    );
    setPending(false);
    if (result.ok) {
      toast({
        title: 'Assignments switched',
        description: result.warning,
        variant: result.warning ? 'info' : undefined,
      });
      setSwitching(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not switch',
        description: result.error,
        variant: 'error',
      });
    }
  }

  // Doors first (in dock-door sort order), then tasks, then the unassigned
  // bucket — only keys that actually have assignments.
  const orderedGroupKeys = [
    ...dockDoors.map((d) => `door:${d.id}`).filter((key) => groups.has(key)),
    ...tasks.map((t) => `task:${t.id}`).filter((key) => groups.has(key)),
    ...(groups.has('task:none') ? ['task:none'] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-foreground text-lg font-semibold">
            Review board
          </h2>
          {rotationScore.total > 0 ? (
            <Badge
              tone={rotationQuality(rotationScore.score).tone}
              title={`${rotationScore.conflicts} of ${rotationScore.total} repeat a recent planned task`}
            >
              {rotationScore.score}% rotation ·{' '}
              {rotationQuality(rotationScore.score).label}
            </Badge>
          ) : null}
        </div>
        {!readOnly ? (
          <Button size="sm" onClick={() => openAdd()} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add assignment
          </Button>
        ) : null}
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Auto-generate from a template above, or add assignments from the available pool."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderedGroupKeys.map((key) => (
            <Card key={key}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  {groupLabel(key)}
                  <span className="text-foreground-subtle ml-1 font-normal">
                    ({groups.get(key)!.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {groups.get(key)!.map((a) => (
                  <div
                    key={a.id}
                    className="border-border rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-medium">
                          {nameOf.get(a.associateId) ?? '—'}
                        </p>
                        <p className="text-foreground-muted text-xs">
                          {groupBy === 'door' && a.taskTypeId
                            ? `${taskName.get(a.taskTypeId) ?? '—'} · `
                            : ''}
                          {a.equipmentId
                            ? (equipName.get(a.equipmentId) ?? '—')
                            : 'No equipment'}
                          {groupBy === 'task' && a.dockDoorId
                            ? ` · Door ${doorName.get(a.dockDoorId) ?? '—'}`
                            : ''}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {conflictDate(a) ? (
                      <p className="text-warning mt-1.5 flex items-center gap-1 text-xs">
                        <AlertTriangle
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        Planned{' '}
                        {taskName.get(a.taskTypeId ?? '') ?? 'this task'} on{' '}
                        {conflictDate(a)}
                      </p>
                    ) : null}
                    {!readOnly ? (
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-1.5"
                          aria-label="Edit assignment"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openSwitch(a)}
                          className="text-foreground-muted hover:bg-surface-raised hover:text-foreground rounded-md p-1.5"
                          aria-label="Switch assignment"
                        >
                          <ArrowLeftRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemovingItem(a)}
                          className="text-foreground-muted hover:bg-surface-raised hover:text-danger rounded-md p-1.5"
                          aria-label="Remove assignment"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Available pool */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            Available pool
            <span className="text-foreground-subtle ml-1 font-normal">
              ({pool.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {pool.length === 0 ? (
            <p className="text-foreground-subtle text-sm">
              Everyone eligible is assigned.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {pool.map((a) =>
                readOnly ? (
                  <li
                    key={a.id}
                    className="border-border rounded-full border px-3 py-1 text-sm"
                  >
                    {fullName(a)}
                  </li>
                ) : (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => openAdd(a.id)}
                      className="border-border hover:bg-surface-raised inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      {fullName(a)}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Edit / Add modal */}
      <Modal
        open={editing !== null || adding}
        onClose={closeForm}
        title={editing ? 'Edit assignment' : 'Add assignment'}
        footer={
          <>
            <Button variant="ghost" onClick={closeForm} disabled={pending}>
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
            label="Associate"
            htmlFor="asg-assoc"
            error={form.formState.errors.associateId?.message}
          >
            <Select id="asg-assoc" {...form.register('associateId')}>
              <option value="">Select an associate</option>
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {fullName(a)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task" htmlFor="asg-task">
            <Select id="asg-task" {...form.register('taskTypeId')}>
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment" htmlFor="asg-equip">
            <Select id="asg-equip" {...form.register('equipmentId')}>
              <option value="">None</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dock door" htmlFor="asg-door">
            <Select id="asg-door" {...form.register('dockDoorId')}>
              <option value="">None</option>
              {dockDoors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doorNumber}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="asg-notes">
            <Input
              id="asg-notes"
              {...form.register('notes')}
              placeholder="Optional"
            />
          </Field>
        </form>
      </Modal>

      {/* Switch modal */}
      <Modal
        open={switching !== null}
        onClose={() => setSwitching(null)}
        title="Switch assignment"
        description={
          switching
            ? `Swap tasks between ${nameOf.get(switching.associateId) ?? '—'} and another associate.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSwitching(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSwitch}
              disabled={pending || !switchTargetId}
            >
              {pending ? 'Switching…' : 'Switch'}
            </Button>
          </>
        }
      >
        <Field label="Switch with" htmlFor="switch-target">
          <Select
            id="switch-target"
            value={switchTargetId}
            onChange={(e) => setSwitchTargetId(e.target.value)}
          >
            <option value="">Select an assignment</option>
            {assignments
              .filter((a) => a.id !== switching?.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {nameOf.get(a.associateId) ?? '—'} —{' '}
                  {a.taskTypeId
                    ? (taskName.get(a.taskTypeId) ?? '—')
                    : 'No task'}
                </option>
              ))}
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!removingItem}
        title="Remove assignment?"
        description={
          removingItem
            ? `${nameOf.get(removingItem.associateId) ?? 'This associate'} will return to the available pool.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={confirmRemove}
        onCancel={() => setRemovingItem(null)}
      />
    </div>
  );
}
