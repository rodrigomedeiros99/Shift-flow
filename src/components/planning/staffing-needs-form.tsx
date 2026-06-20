'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  NumberStepper,
  useToast,
} from '@/components/ui';
import { UphCalculator, type UphCalcRow } from './uph-calculator';
import { saveStaffingNeeds } from '@/features/planning/actions';
import { recommendedPeople } from '@/features/planning/uph';
import type { StaffingNeed, UphCalculation } from '@/features/planning/queries';
import type { TaskType } from '@/types/domain';

interface StaffingNeedsFormProps {
  planId: string;
  tasks: TaskType[];
  needs: StaffingNeed[];
  /** Saved UPH snapshot — restores the units the supervisor last entered. */
  uphCalculations: UphCalculation[];
  /** Productive hours of the plan's shift key, or null if not configured. */
  shiftHours: number | null;
  /** Inbound asks for non-door tasks; doors are handled separately. */
  isInbound: boolean;
  /** Associates still available after absences + special assignments. */
  availableCount: number;
}

/**
 * v2 plan start: a UPH labor calculator (recommendation) above the manual
 * Staffing Needs. Apply fills a task's people count from the recommendation, but
 * the supervisor always controls the final number. Both the final counts and the
 * UPH snapshot are saved together. Tasks come from Settings — nothing hardcoded.
 */
export function StaffingNeedsForm({
  planId,
  tasks,
  needs,
  uphCalculations,
  shiftHours,
  isInbound,
  availableCount,
}: StaffingNeedsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  // Door-driven tasks (inbound unload) are staffed from the active dock doors in
  // the next step, so they don't get a manual people count here.
  const visibleTasks = isInbound
    ? tasks.filter((t) => !t.needsDockDoor)
    : tasks;

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const t of visibleTasks) initial[t.id] = 0;
    for (const n of needs) initial[n.taskTypeId] = n.peopleNeeded;
    return initial;
  });
  const [units, setUnits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const c of uphCalculations) initial[c.taskTypeId] = c.unitsPlanned;
    return initial;
  });

  const total = visibleTasks.reduce((sum, t) => sum + (counts[t.id] ?? 0), 0);

  function setCount(taskId: string, value: number) {
    setCounts((prev) => ({ ...prev, [taskId]: Math.max(0, value || 0) }));
  }
  function setUnit(taskId: string, value: number) {
    setUnits((prev) => ({ ...prev, [taskId]: Math.max(0, value || 0) }));
  }

  const uphFor = (t: TaskType) => (t.usesUph ? t.avgUnitsPerHour : null);
  const recFor = (t: TaskType) =>
    recommendedPeople(units[t.id] ?? 0, uphFor(t), shiftHours);

  // Calculator rows: every active task (incl. inbound unload, shown for info).
  const calcRows: UphCalcRow[] = useMemo(
    () =>
      tasks.map((t) => ({
        taskId: t.id,
        taskName: t.name,
        usesUph: t.usesUph,
        uph: uphFor(t),
        units: units[t.id] ?? 0,
        recommended: recFor(t),
        doorDriven: isInbound && t.needsDockDoor,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, units, shiftHours, isInbound],
  );

  const totalRecommended = calcRows.reduce(
    (sum, r) => sum + (r.recommended ?? 0),
    0,
  );

  function applyOne(taskId: string) {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || (isInbound && t.needsDockDoor)) return;
    const rec = recFor(t);
    if (rec !== null) setCount(taskId, rec);
  }
  function applyAll() {
    setCounts((prev) => {
      const next = { ...prev };
      for (const t of visibleTasks) {
        const rec = recFor(t);
        if (rec !== null) next[t.id] = rec;
      }
      return next;
    });
  }

  async function save() {
    setPending(true);
    const result = await saveStaffingNeeds(planId, {
      rows: visibleTasks.map((t) => ({
        taskTypeId: t.id,
        peopleNeeded: counts[t.id] ?? 0,
      })),
      uph: tasks.map((t) => ({
        taskTypeId: t.id,
        unitsPlanned: units[t.id] ?? 0,
        uphUsed: uphFor(t),
        shiftHoursUsed: shiftHours,
        recommendedPeople: recFor(t),
        finalPeople: counts[t.id] ?? 0,
      })),
    });
    setPending(false);
    if (result.ok) {
      toast({ title: 'Staffing needs saved' });
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
    <div className="space-y-4">
      {tasks.length > 0 ? (
        <UphCalculator
          rows={calcRows}
          shiftHours={shiftHours}
          totalRecommended={totalRecommended}
          totalFinal={total}
          pending={pending}
          onUnitsChange={setUnit}
          onApply={applyOne}
          onApplyAll={applyAll}
        />
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            Staffing needs
            <span className="text-foreground-subtle ml-2 text-sm font-normal">
              {total} {total === 1 ? 'person' : 'people'} requested
            </span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="border-primary/40 text-foreground rounded-full border px-3 py-1 text-sm font-medium">
              Available associates: {availableCount}
            </span>
            <Button size="sm" onClick={save} disabled={pending}>
              Save staffing needs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {visibleTasks.length === 0 ? (
            <p className="text-foreground-muted text-sm">
              {isInbound
                ? 'All inbound tasks are staffed from the active dock doors in the next step.'
                : 'No tasks configured for this department. Add tasks under Settings → Tasks.'}
            </p>
          ) : (
            <>
              {isInbound ? (
                <p className="text-foreground-muted mb-4 text-sm">
                  Unloading is staffed from the active dock doors in the next
                  step. Enter people for the other inbound tasks here.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleTasks.map((t) => (
                  <div
                    key={t.id}
                    className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <label
                      htmlFor={`need-${t.id}`}
                      className="text-foreground text-sm font-medium"
                    >
                      {t.name}
                    </label>
                    <NumberStepper
                      id={`need-${t.id}`}
                      aria-label={`People needed for ${t.name}`}
                      value={counts[t.id] ?? 0}
                      onChange={(n) => setCount(t.id, n)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
