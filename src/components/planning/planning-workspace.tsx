'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button, ConfirmDialog, Select, useToast } from '@/components/ui';
import { MorningSetup } from './morning-setup';
import { DockDoorSelection } from './dock-door-selection';
import { StaffingNeedsForm } from './staffing-needs-form';
import { DraftDeleteButton } from './draft-delete-button';
import { GeneratePanel } from './generate-panel';
import { ReviewBoard } from './review-board';
import { publishPlan } from '@/features/planning/actions';
import type {
  PlanDockDoorRow,
  PlanInputs,
  StaffingNeed,
  UphCalculation,
} from '@/features/planning/queries';
import type { RotationRecord } from '@/features/planning/rotation';
import type {
  Assignment,
  CallOff,
  DailyPlan,
  SpecialAssignment,
} from '@/types/domain';
import type { DepartmentKind } from '@/lib/constants/departments';

interface PlanningWorkspaceProps {
  plan: DailyPlan;
  deptKind: DepartmentKind;
  inputs: PlanInputs;
  assignments: Assignment[];
  callOffs: CallOff[];
  specials: SpecialAssignment[];
  /** Dock doors marked active for this plan, with per-day equipment (inbound). */
  activeDoors: PlanDockDoorRow[];
  /** People-per-task demand entered for this plan (v2). */
  staffingNeeds: StaffingNeed[];
  /** Saved UPH calculation snapshot for this plan. */
  uphCalculations: UphCalculation[];
  /** Productive hours of the plan's shift key, or null if not configured. */
  shiftHours: number | null;
  /** Planned-history rows for fair-rotation notices/score (Phase 7). */
  rotationRecords: RotationRecord[];
}

/** Rotation lookback windows; default = previous day. */
const LOOKBACK_OPTIONS = [
  { value: 1, label: 'Last day' },
  { value: 2, label: 'Last 2 days' },
  { value: 3, label: 'Last 3 days' },
  { value: 4, label: 'Last 4 days' },
  { value: 7, label: 'Last week' },
] as const;

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-primary/15 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
        {n}
      </span>
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
    </div>
  );
}

export function PlanningWorkspace({
  plan,
  deptKind,
  inputs,
  assignments,
  callOffs,
  specials,
  activeDoors,
  staffingNeeds,
  uphCalculations,
  shiftHours,
  rotationRecords,
}: PlanningWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(1);

  const published = plan.status !== 'draft';
  const isInbound = deptKind === 'inbound';
  const boardGroupBy = isInbound ? 'door' : 'task';
  const totalNeeded =
    staffingNeeds.reduce((sum, n) => sum + n.peopleNeeded, 0) +
    (isInbound ? activeDoors.length : 0);

  // Available = eligible associates minus absences (call-off/vacation/STO) and
  // anyone committed to a special assignment (overtime/training/middle-mile/…).
  const availableCount = (() => {
    const used = new Set<string>();
    for (const c of callOffs) used.add(c.associateId);
    for (const s of specials) {
      used.add(s.associateId);
      if (s.relatedAssociateId) used.add(s.relatedAssociateId);
    }
    return inputs.associates.filter((a) => !used.has(a.id)).length;
  })();

  async function confirmPublish() {
    setPending(true);
    const result = await publishPlan(plan.id);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Plan published' });
      setConfirming(false);
      router.refresh();
    } else {
      toast({
        title: 'Could not publish',
        description: result.error,
        variant: 'error',
      });
    }
  }

  if (published) {
    return (
      <div className="space-y-6">
        <div className="border-success/40 bg-success/10 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-success h-5 w-5" aria-hidden="true" />
            <p className="text-foreground text-sm font-medium">
              This plan is published and read-only.
            </p>
          </div>
          {plan.status === 'published' ? (
            <Link href={`/live-plan/${plan.id}`}>
              <Button size="sm" variant="secondary">
                Manage live
              </Button>
            </Link>
          ) : null}
        </div>
        <ReviewBoard
          planId={plan.id}
          assignments={assignments}
          associates={inputs.associates}
          tasks={inputs.tasks}
          equipment={inputs.equipment}
          dockDoors={inputs.dockDoors}
          callOffs={callOffs}
          specials={specials}
          groupBy={boardGroupBy}
          rotationRecords={rotationRecords}
          planDate={plan.planDate}
          totalNeeded={totalNeeded}
          readOnly
        />
      </div>
    );
  }

  const activeTasks = inputs.tasks.filter((t) => t.active);

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <DraftDeleteButton planId={plan.id} redirectTo="/create-plan" />
      </div>

      <div className="border-border bg-surface-raised/40 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
        <div>
          <p className="text-foreground text-sm font-medium">Fair rotation</p>
          <p className="text-foreground-muted text-xs">
            Auto-generate and warnings avoid repeating an associate&apos;s
            recent planned task.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground-muted">Lookback</span>
          <Select
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            className="w-40"
          >
            {LOOKBACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <section className="space-y-4">
        <StepHeading n={1} title="Staffing needs" />
        <StaffingNeedsForm
          planId={plan.id}
          tasks={activeTasks}
          needs={staffingNeeds}
          uphCalculations={uphCalculations}
          shiftHours={shiftHours}
          isInbound={isInbound}
          availableCount={availableCount}
        />
      </section>

      <section className="space-y-4">
        <StepHeading n={2} title="Support &amp; exceptions" />
        {isInbound ? (
          <DockDoorSelection
            planId={plan.id}
            dockDoors={inputs.dockDoors}
            equipment={inputs.equipment}
            activeDoors={activeDoors}
          />
        ) : null}
        <MorningSetup
          planId={plan.id}
          deptKind={deptKind}
          middleMileOwner={plan.middleMileOwner}
          associates={inputs.associates}
          tasks={inputs.tasks}
          equipment={inputs.equipment}
          callOffs={callOffs}
          specials={specials}
        />
      </section>

      <section className="space-y-4">
        <StepHeading n={3} title="Auto generate plan" />
        <GeneratePanel planId={plan.id} lookbackDays={lookbackDays} />
      </section>

      <section className="space-y-4">
        <StepHeading n={4} title="Review &amp; publish" />
        <ReviewBoard
          planId={plan.id}
          assignments={assignments}
          associates={inputs.associates}
          tasks={inputs.tasks}
          equipment={inputs.equipment}
          dockDoors={inputs.dockDoors}
          callOffs={callOffs}
          specials={specials}
          groupBy={boardGroupBy}
          rotationRecords={rotationRecords}
          certificationsByAssociate={inputs.certificationsByAssociate}
          planDate={plan.planDate}
          lookbackDays={lookbackDays}
          totalNeeded={totalNeeded}
        />
        <div className="flex justify-end">
          <Button onClick={() => setConfirming(true)} disabled={pending}>
            Publish plan
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Publish this plan?"
        description="Publishing freezes the official planned assignment history for this shift and makes the plan read-only."
        confirmLabel="Publish"
        pending={pending}
        onConfirm={confirmPublish}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
