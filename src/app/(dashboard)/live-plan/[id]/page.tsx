import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { LiveWorkspace } from '@/components/live/live-workspace';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { listDepartments, listShiftKeys } from '@/features/config/queries';
import {
  getPlan,
  getPlanInputs,
  listCallOffs,
  listPlanAssignments,
  listSpecialAssignments,
} from '@/features/planning/queries';
import { listActivity } from '@/features/live/queries';
import { formatDateUS } from '@/lib/utils/date';

export default async function LivePlanWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(PLANNER_ROLES);
  const { id } = await params;

  const plan = await getPlan(id);
  if (!plan) notFound();
  // A draft isn't live yet — send the leader back to finish and publish it.
  if (plan.status === 'draft') redirect(`/create-plan/${id}`);

  const [
    inputs,
    assignments,
    callOffs,
    specials,
    activity,
    departments,
    shiftKeys,
  ] = await Promise.all([
    getPlanInputs(plan.departmentId, plan.shiftKeyId),
    listPlanAssignments(id),
    listCallOffs(id),
    listSpecialAssignments(id),
    listActivity(id),
    listDepartments(),
    listShiftKeys(),
  ]);

  const department = departments.find((d) => d.id === plan.departmentId);
  const deptName = department?.name ?? 'Plan';
  const deptKind = department?.kind ?? 'other';
  const keyName = shiftKeys.find((k) => k.id === plan.shiftKeyId)?.name ?? '';

  return (
    <>
      <PageHeader
        title={`${deptName} — ${keyName}`}
        description={`Live operations · ${formatDateUS(plan.planDate)}`}
      />
      <LiveWorkspace
        plan={plan}
        deptKind={deptKind}
        inputs={inputs}
        assignments={assignments}
        callOffs={callOffs}
        specials={specials}
        departments={departments}
        activity={activity}
      />
    </>
  );
}
