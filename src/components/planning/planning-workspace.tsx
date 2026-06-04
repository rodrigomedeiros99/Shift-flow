'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button, ConfirmDialog, Select, useToast } from '@/components/ui';
import { MorningSetup } from './morning-setup';
import { DockDoorSelection } from './dock-door-selection';
import { GeneratePanel } from './generate-panel';
import { ReviewBoard } from './review-board';
import { publishPlan } from '@/features/planning/actions';
import type { PlanInputs } from '@/features/planning/queries';
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
  /** Dock doors marked active for this plan (inbound). */
  activeDoorIds: string[];
  /** Planned-history rows for fair-rotation notices/score (Phase 7). */
  rotationRecords: RotationRecord[];
}

/** Rotation lookback windows (PRD §7); default = previous day. */
const LOOKBACK_OPTIONS = [
  { value: 1, label: 'Yesterday' },
  { value: 3, label: 'Last 3 days' },
  { value: 7, label: 'Last week' },
  { value: 30, label: 'Last 30 days' },
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
  activeDoorIds,
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
          readOnly
        />
      </div>
    );
  }

  // Inbound inserts a "Dock doors" step between setup and generate, shifting
  // the later step numbers by one.
  const generateStep = isInbound ? 3 : 2;
  const reviewStep = isInbound ? 4 : 3;

  return (
    <div className="space-y-10">
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
        <StepHeading n={1} title="Morning setup" />
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

      {isInbound ? (
        <section className="space-y-4">
          <StepHeading n={2} title="Dock doors" />
          <DockDoorSelection
            planId={plan.id}
            dockDoors={inputs.dockDoors}
            activeDoorIds={activeDoorIds}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <StepHeading n={generateStep} title="Generate" />
        <GeneratePanel
          planId={plan.id}
          templates={inputs.templates}
          lookbackDays={lookbackDays}
        />
      </section>

      <section className="space-y-4">
        <StepHeading n={reviewStep} title="Review &amp; publish" />
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
          lookbackDays={lookbackDays}
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
