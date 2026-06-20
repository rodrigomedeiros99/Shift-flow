'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import { StatusMenu } from './status-menu';
import {
  addLiveAssignment,
  completeAssignment,
  moveAssignment,
  removeLiveAssignment,
  setAssignmentStatus,
  switchLive,
} from '@/features/live/actions';
import type {
  Assignment,
  Associate,
  CallOff,
  DockDoor,
  EquipmentType,
  SpecialAssignment,
  TaskType,
} from '@/types/domain';
import type { AssignmentType } from '@/lib/constants/assignments';

interface LiveBoardProps {
  planId: string;
  assignments: Assignment[];
  associates: Associate[];
  tasks: TaskType[];
  equipment: EquipmentType[];
  dockDoors: DockDoor[];
  callOffs: CallOff[];
  specials: SpecialAssignment[];
  groupBy: 'task' | 'door';
  readOnly?: boolean;
}

const fullName = (a: Associate) => `${a.firstName} ${a.lastName}`;

const ADD_TYPES: { value: AssignmentType; label: string }[] = [
  { value: 'planned', label: 'Regular' },
  { value: 'support', label: 'Support' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'overtime', label: 'Overtime' },
];

export function LiveBoard({
  planId,
  assignments,
  associates,
  tasks,
  equipment,
  dockDoors,
  callOffs,
  specials,
  groupBy,
  readOnly = false,
}: LiveBoardProps) {
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

  // Completed assignments leave the board; their associate returns to the pool.
  const active = useMemo(
    () => assignments.filter((a) => a.status !== 'completed'),
    [assignments],
  );

  const pool = useMemo(() => {
    const occupied = new Set<string>();
    for (const a of active) occupied.add(a.associateId);
    for (const c of callOffs) occupied.add(c.associateId);
    for (const s of specials) {
      occupied.add(s.associateId);
      if (s.relatedAssociateId) occupied.add(s.relatedAssociateId);
    }
    return associates.filter((a) => !occupied.has(a.id));
  }, [active, associates, callOffs, specials]);

  const groups = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of active) {
      const key =
        groupBy === 'door' && a.dockDoorId
          ? `door:${a.dockDoorId}`
          : `task:${a.taskTypeId ?? 'none'}`;
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [active, groupBy]);

  const orderedKeys = [
    ...dockDoors.map((d) => `door:${d.id}`).filter((k) => groups.has(k)),
    ...tasks.map((t) => `task:${t.id}`).filter((k) => groups.has(k)),
    ...(groups.has('task:none') ? ['task:none'] : []),
  ];
  const groupLabel = (key: string) =>
    key.startsWith('door:')
      ? `Door ${doorName.get(key.slice(5)) ?? '—'}`
      : key === 'task:none'
        ? 'Unassigned'
        : (taskName.get(key.slice(5)) ?? '—');

  async function run(
    action: () => Promise<
      { ok: true; warning?: string } | { ok: false; error: string }
    >,
    successTitle: string,
  ) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.ok) {
      toast({
        title: successTitle,
        description: 'warning' in result ? result.warning : undefined,
        variant: 'warning' in result && result.warning ? 'info' : undefined,
      });
      router.refresh();
      return true;
    }
    toast({
      title: 'Could not save',
      description: result.error,
      variant: 'error',
    });
    return false;
  }

  // --- Move modal ---
  const [moving, setMoving] = useState<Assignment | null>(null);
  const [mTask, setMTask] = useState('');
  const [mEquip, setMEquip] = useState('');
  const [mDoor, setMDoor] = useState('');
  const [mNotes, setMNotes] = useState('');
  function openMove(a: Assignment) {
    setMoving(a);
    setMTask(a.taskTypeId ?? '');
    setMEquip(a.equipmentId ?? '');
    setMDoor(a.dockDoorId ?? '');
    setMNotes(a.notes ?? '');
  }
  async function submitMove() {
    if (!moving) return;
    const okDone = await run(
      () =>
        moveAssignment(moving.id, planId, {
          taskTypeId: mTask,
          equipmentId: mEquip,
          dockDoorId: mDoor,
          notes: mNotes,
        }),
      'Associate moved',
    );
    if (okDone) setMoving(null);
  }

  // --- Switch modal ---
  const [switching, setSwitching] = useState<Assignment | null>(null);
  const [switchTarget, setSwitchTarget] = useState('');
  async function submitSwitch() {
    if (!switching || !switchTarget) return;
    const okDone = await run(
      () => switchLive(planId, switching.id, switchTarget),
      'Assignments switched',
    );
    if (okDone) setSwitching(null);
  }

  // --- Remove confirm ---
  const [removing, setRemoving] = useState<Assignment | null>(null);
  async function confirmRemove() {
    if (!removing) return;
    const okDone = await run(
      () => removeLiveAssignment(removing.id, planId),
      'Assignment removed',
    );
    if (okDone) setRemoving(null);
  }

  // --- Assign modal (pool / add) ---
  const [assigning, setAssigning] = useState(false);
  const [aAssoc, setAAssoc] = useState('');
  const [aType, setAType] = useState<AssignmentType>('planned');
  const [aTask, setATask] = useState('');
  const [aEquip, setAEquip] = useState('');
  const [aDoor, setADoor] = useState('');
  function openAssign(associateId = '') {
    setAAssoc(associateId);
    setAType('planned');
    setATask('');
    setAEquip('');
    setADoor('');
    setAssigning(true);
  }
  async function submitAssign() {
    const okDone = await run(
      () =>
        addLiveAssignment(
          planId,
          {
            associateId: aAssoc,
            taskTypeId: aTask,
            equipmentId: aEquip,
            dockDoorId: aDoor,
          },
          aType,
        ),
      'Assigned',
    );
    if (okDone) setAssigning(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Live board</h2>
        {!readOnly ? (
          <Button size="sm" className="gap-2" onClick={() => openAssign()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Assign
          </Button>
        ) : null}
      </div>

      {active.length === 0 ? (
        <EmptyState
          title="No active assignments"
          description="Assign associates from the available pool to get the floor moving."
        />
      ) : (
        <div className="space-y-6">
          {orderedKeys.map((key) => (
            <section key={key} className="space-y-3">
              {/* Strong, high-contrast task/door label (request F.4) */}
              <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-base font-bold tracking-wide uppercase">
                  {groupLabel(key)}
                </span>
                <span className="text-foreground-subtle text-sm">
                  {groups.get(key)!.length}
                </span>
              </div>
              {/* Cards expand horizontally within the section (request F.3) */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groups.get(key)!.map((a) => (
                  <div
                    key={a.id}
                    className="border-border bg-surface rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-semibold">
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

                    {!readOnly ? (
                      <>
                        <div className="mt-2">
                          <StatusMenu
                            status={a.status}
                            pending={pending}
                            onSet={(s) =>
                              run(
                                () => setAssignmentStatus(a.id, planId, s),
                                'Status updated',
                              )
                            }
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          <IconButton
                            label="Complete (return to pool)"
                            tone="success"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => completeAssignment(a.id, planId),
                                'Marked complete',
                              )
                            }
                            icon={
                              <CheckCircle2
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            }
                          />
                          <IconButton
                            label="Move"
                            onClick={() => openMove(a)}
                            icon={
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                          <IconButton
                            label="Switch"
                            onClick={() => {
                              setSwitching(a);
                              setSwitchTarget('');
                            }}
                            icon={
                              <ArrowLeftRight
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            }
                          />
                          <IconButton
                            label="Remove"
                            tone="danger"
                            onClick={() => setRemoving(a)}
                            icon={
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
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
                      onClick={() => openAssign(a.id)}
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

      {/* Move modal */}
      <Modal
        open={moving !== null}
        onClose={() => setMoving(null)}
        title={`Move ${moving ? (nameOf.get(moving.associateId) ?? '') : ''}`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setMoving(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitMove} disabled={pending}>
              {pending ? 'Saving…' : 'Move'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Task" htmlFor="mv-task">
            <Select
              id="mv-task"
              value={mTask}
              onChange={(e) => setMTask(e.target.value)}
            >
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment" htmlFor="mv-equip">
            <Select
              id="mv-equip"
              value={mEquip}
              onChange={(e) => setMEquip(e.target.value)}
            >
              <option value="">None</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dock door" htmlFor="mv-door">
            <Select
              id="mv-door"
              value={mDoor}
              onChange={(e) => setMDoor(e.target.value)}
            >
              <option value="">None</option>
              {dockDoors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doorNumber}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="mv-notes">
            <Input
              id="mv-notes"
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
      </Modal>

      {/* Switch modal */}
      <Modal
        open={switching !== null}
        onClose={() => setSwitching(null)}
        title="Switch assignment"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSwitching(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitSwitch} disabled={pending || !switchTarget}>
              {pending ? 'Switching…' : 'Switch'}
            </Button>
          </>
        }
      >
        <Field label="Switch with" htmlFor="sw-target">
          <Select
            id="sw-target"
            value={switchTarget}
            onChange={(e) => setSwitchTarget(e.target.value)}
          >
            <option value="">Select an assignment</option>
            {active
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

      {/* Assign modal */}
      <Modal
        open={assigning}
        onClose={() => setAssigning(false)}
        title="Assign associate"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setAssigning(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitAssign} disabled={pending || !aAssoc}>
              {pending ? 'Assigning…' : 'Assign'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Associate" htmlFor="as-assoc">
            <Select
              id="as-assoc"
              value={aAssoc}
              onChange={(e) => setAAssoc(e.target.value)}
            >
              <option value="">Select an associate</option>
              {pool.map((a) => (
                <option key={a.id} value={a.id}>
                  {fullName(a)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="as-type">
            <Select
              id="as-type"
              value={aType}
              onChange={(e) => setAType(e.target.value as AssignmentType)}
            >
              {ADD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Task" htmlFor="as-task">
            <Select
              id="as-task"
              value={aTask}
              onChange={(e) => setATask(e.target.value)}
            >
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment" htmlFor="as-equip">
            <Select
              id="as-equip"
              value={aEquip}
              onChange={(e) => setAEquip(e.target.value)}
            >
              <option value="">None</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dock door" htmlFor="as-door">
            <Select
              id="as-door"
              value={aDoor}
              onChange={(e) => setADoor(e.target.value)}
            >
              <option value="">None</option>
              {dockDoors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doorNumber}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        title="Remove assignment?"
        description={
          removing
            ? `${nameOf.get(removing.associateId) ?? 'This associate'} returns to the available pool.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
