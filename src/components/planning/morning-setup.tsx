'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Modal,
  Select,
  useToast,
} from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  addOvertime,
  addSpecialAssignment,
  addTrainingPair,
  removeSpecialAssignment,
  saveNotAvailable,
  setMiddleMileOwner,
} from '@/features/planning/actions';
import type {
  Associate,
  CallOff,
  EquipmentType,
  SpecialAssignment,
  TaskType,
} from '@/types/domain';
import type { SpecialAssignmentType } from '@/lib/constants/assignments';
import type { DepartmentKind } from '@/lib/constants/departments';

interface MorningSetupProps {
  planId: string;
  deptKind: DepartmentKind;
  middleMileOwner: 'outbound' | 'inbound' | null;
  associates: Associate[];
  tasks: TaskType[];
  equipment: EquipmentType[];
  callOffs: CallOff[];
  specials: SpecialAssignment[];
}

type AddKind = Exclude<SpecialAssignmentType, never>;

/**
 * "Not Available" — the single absence section. The reason (call-off / vacation /
 * time off) doesn't matter for plan generation; the planner only marks who can't
 * be assigned today, and they're removed from the available pool.
 */
function NotAvailableCard({
  planId,
  associates,
  initialIds,
}: {
  planId: string;
  associates: Associate[];
  initialIds: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialIds),
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setPending(true);
    const result = await saveNotAvailable(planId, [...checked]);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Not Available saved' });
      router.refresh();
    } else {
      toast({
        title: 'Could not save',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          Not Available
          {checked.size > 0 ? (
            <span className="text-foreground-subtle ml-2 text-sm font-normal">
              {checked.size} selected
            </span>
          ) : null}
        </CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>
          Save
        </Button>
      </CardHeader>
      <CardContent>
        {associates.length === 0 ? (
          <p className="text-foreground-muted text-sm">
            No eligible associates for this department and key.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {associates.map((a) => (
              <Checkbox
                key={a.id}
                id={`unavailable-${a.id}`}
                label={fullName(a)}
                checked={checked.has(a.id)}
                onChange={() => toggle(a.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const fullName = (a: Associate) => `${a.firstName} ${a.lastName}`;

function SpecialRow({
  s,
  nameOf,
  taskName,
  pending,
  onRemove,
}: {
  s: SpecialAssignment;
  nameOf: Map<string, string>;
  taskName: Map<string, string>;
  pending: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span>
        <span className="font-medium">{nameOf.get(s.associateId) ?? '—'}</span>
        {s.relatedAssociateId ? (
          <span className="text-foreground-muted">
            {' '}
            + {nameOf.get(s.relatedAssociateId) ?? '—'}
          </span>
        ) : null}
        {s.taskTypeId ? (
          <span className="text-foreground-muted">
            {' · '}
            {taskName.get(s.taskTypeId) ?? '—'}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => onRemove(s.id)}
        disabled={pending}
        className="text-foreground-muted hover:text-danger rounded-md p-1"
        aria-label="Remove"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function SpecialSection({
  title,
  addLabel,
  rows,
  onAdd,
  nameOf,
  taskName,
  pending,
  onRemove,
}: {
  title: string;
  addLabel: string;
  rows: SpecialAssignment[];
  onAdd: () => void;
  nameOf: Map<string, string>;
  taskName: Map<string, string>;
  pending: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-foreground-subtle text-sm">None.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((s) => (
            <SpecialRow
              key={s.id}
              s={s}
              nameOf={nameOf}
              taskName={taskName}
              pending={pending}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function MorningSetup({
  planId,
  deptKind,
  middleMileOwner,
  associates,
  tasks,
  equipment,
  callOffs,
  specials,
}: MorningSetupProps) {
  const isInbound = deptKind === 'inbound';
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

  // Everyone marked unavailable today, regardless of original reason.
  const notAvailableIds = callOffs.map((c) => c.associateId);

  // --- Add special modal ---
  const [adding, setAdding] = useState<AddKind | null>(null);
  const [associateId, setAssociateId] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');

  function openAdd(kind: AddKind) {
    setAdding(kind);
    setAssociateId('');
    setRelatedId('');
    setTaskTypeId('');
    setEquipmentId('');
  }

  async function submitAdd() {
    if (!adding) return;
    setPending(true);
    let result;
    if (adding === 'overtime') {
      result = await addOvertime(planId, {
        associateId,
        taskTypeId,
        equipmentId,
      });
    } else if (adding === 'training') {
      result = await addTrainingPair(planId, {
        associateId,
        relatedAssociateId: relatedId,
        taskTypeId,
        equipmentId,
      });
    } else {
      result = await addSpecialAssignment(planId, adding, {
        associateId,
        taskTypeId,
        equipmentId,
      });
    }
    setPending(false);
    if (result.ok) {
      toast({ title: 'Added' });
      setAdding(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not add',
        description: result.error,
        variant: 'error',
      });
    }
  }

  async function remove(id: string) {
    setPending(true);
    const result = await removeSpecialAssignment(id, planId);
    setPending(false);
    if (result.ok) router.refresh();
    else
      toast({
        title: 'Could not remove',
        description: result.error,
        variant: 'error',
      });
  }

  const byType = (type: SpecialAssignmentType) =>
    specials.filter((s) => s.type === type);

  const sectionProps = { nameOf, taskName, pending, onRemove: remove };
  const requiresTask = adding === 'overtime' || adding === 'training';

  return (
    <div className="space-y-6">
      {/* Not Available — removes the associate from the available pool. */}
      <NotAvailableCard
        planId={planId}
        associates={associates}
        initialIds={notAvailableIds}
      />

      {/* Overtime + Training */}
      <Card>
        <CardHeader>
          <CardTitle>Overtime &amp; training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SpecialSection
            title="Overtime"
            addLabel="Add overtime"
            rows={byType('overtime')}
            onAdd={() => openAdd('overtime')}
            {...sectionProps}
          />
          <SpecialSection
            title="Training"
            addLabel="Add pair"
            rows={byType('training')}
            onAdd={() => openAdd('training')}
            {...sectionProps}
          />
          {isInbound ? (
            <SpecialSection
              title="Support Outbound"
              addLabel="Add"
              rows={byType('support_outbound')}
              onAdd={() => openAdd('support_outbound')}
              {...sectionProps}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Middle Mile */}
      <Card>
        <CardHeader>
          <CardTitle>Middle Mile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={middleMileOwner === 'outbound' ? 'primary' : 'outline'}
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const r = await setMiddleMileOwner(planId, 'outbound');
                setPending(false);
                if (r.ok) router.refresh();
              }}
            >
              Outbound
            </Button>
            <Button
              size="sm"
              variant={middleMileOwner === 'inbound' ? 'primary' : 'outline'}
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const r = await setMiddleMileOwner(planId, 'inbound');
                setPending(false);
                if (r.ok) router.refresh();
              }}
            >
              Inbound
            </Button>
          </div>
          {middleMileOwner === 'inbound' ? (
            <p className="text-foreground-muted text-sm">Handled by Inbound.</p>
          ) : middleMileOwner === 'outbound' ? (
            <SpecialSection
              title="Outbound Middle Mile associates"
              addLabel="Add"
              rows={byType('middle_mile')}
              onAdd={() => openAdd('middle_mile')}
              {...sectionProps}
            />
          ) : (
            <p className="text-foreground-subtle text-sm">
              Choose who handles Middle Mile today.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ICQA Support (outbound) */}
      {!isInbound ? (
        <Card>
          <CardHeader>
            <CardTitle>ICQA Support</CardTitle>
          </CardHeader>
          <CardContent>
            <SpecialSection
              title="ICQA support"
              addLabel="Add"
              rows={byType('icqa_support')}
              onAdd={() => openAdd('icqa_support')}
              {...sectionProps}
            />
          </CardContent>
        </Card>
      ) : null}

      <Modal
        open={adding !== null}
        onClose={() => setAdding(null)}
        title="Add"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setAdding(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={pending}>
              {pending ? 'Saving…' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label={adding === 'training' ? 'Trainer' : 'Associate'}
            htmlFor="sa-assoc"
          >
            <Select
              id="sa-assoc"
              value={associateId}
              onChange={(e) => setAssociateId(e.target.value)}
            >
              <option value="">Select an associate</option>
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {fullName(a)}
                </option>
              ))}
            </Select>
          </Field>

          {adding === 'training' ? (
            <Field label="New hire" htmlFor="sa-related">
              <Select
                id="sa-related"
                value={relatedId}
                onChange={(e) => setRelatedId(e.target.value)}
              >
                <option value="">Select a new hire</option>
                {associates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fullName(a)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field
            label={requiresTask ? 'Task' : 'Task (optional)'}
            htmlFor="sa-task"
          >
            <Select
              id="sa-task"
              value={taskTypeId}
              onChange={(e) => setTaskTypeId(e.target.value)}
            >
              <option value="">
                {requiresTask ? 'Select a task' : 'None'}
              </option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Equipment (optional)" htmlFor="sa-equip">
            <Select
              id="sa-equip"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">None</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
