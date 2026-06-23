'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Lock } from 'lucide-react';
import { Badge, Button, ConfirmDialog, useToast } from '@/components/ui';
import { LiveBoard } from './live-board';
import { RecentActivity } from './recent-activity';
import { closeShift } from '@/features/live/actions';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import type { PlanInputs } from '@/features/planning/queries';
import type {
  ActivityHistory,
  Associate,
  Assignment,
  CallOff,
  DailyPlan,
  Department,
  SpecialAssignment,
} from '@/types/domain';
import type { DepartmentKind } from '@/lib/constants/departments';

interface LiveWorkspaceProps {
  plan: DailyPlan;
  deptKind: DepartmentKind;
  inputs: PlanInputs;
  assignments: Assignment[];
  callOffs: CallOff[];
  specials: SpecialAssignment[];
  departments: Department[];
  activity: ActivityHistory[];
}

const fullName = (a: Associate) => `${a.firstName} ${a.lastName}`;

const LIVE_TABLES = ['assignments', 'activity_history', 'daily_plans'] as const;

export function LiveWorkspace({
  plan,
  deptKind,
  inputs,
  assignments,
  callOffs,
  specials,
  departments,
  activity,
}: LiveWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useRealtimeRefresh(`live-${plan.id}`, LIVE_TABLES);

  const closed = plan.status === 'closed';
  const groupBy = deptKind === 'inbound' ? 'door' : 'task';

  const nameOf = useMemo(
    () => new Map(inputs.associates.map((a) => [a.id, fullName(a)])),
    [inputs.associates],
  );
  const taskName = useMemo(
    () => new Map(inputs.tasks.map((t) => [t.id, t.name])),
    [inputs.tasks],
  );
  const doorName = useMemo(
    () => new Map(inputs.dockDoors.map((d) => [d.id, d.doorNumber])),
    [inputs.dockDoors],
  );

  async function confirmClose() {
    setPending(true);
    const result = await closeShift(plan.id);
    setPending(false);
    if (result.ok) {
      toast({ title: 'Shift closed' });
      setConfirming(false);
      router.refresh();
    } else {
      toast({
        title: 'Could not close shift',
        description: result.error,
        variant: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone={closed ? 'neutral' : 'success'}>
          {closed ? 'Shift closed' : 'Live'}
        </Badge>
        {!closed ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setConfirming(true)}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Close shift
          </Button>
        ) : null}
      </div>

      {closed ? (
        <div className="border-border bg-surface-raised/40 flex items-center gap-3 rounded-md border p-3">
          <CheckCircle2
            className="text-foreground-muted h-5 w-5"
            aria-hidden="true"
          />
          <p className="text-foreground text-sm font-medium">
            This shift is closed. The board and activity timeline are read-only.
          </p>
        </div>
      ) : null}

      <LiveBoard
        planId={plan.id}
        assignments={assignments}
        associates={inputs.associates}
        tasks={inputs.tasks}
        equipment={inputs.equipment}
        dockDoors={inputs.dockDoors}
        callOffs={callOffs}
        specials={specials}
        departments={departments}
        groupBy={groupBy}
        readOnly={closed}
      />

      <RecentActivity
        items={activity}
        nameOf={nameOf}
        taskName={taskName}
        doorName={doorName}
      />

      <ConfirmDialog
        open={confirming}
        title="Close this shift?"
        description="Closing freezes the live board and the activity timeline for the day. This cannot be reopened."
        confirmLabel="Close shift"
        pending={pending}
        onConfirm={confirmClose}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
