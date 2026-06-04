import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { PlanningWorkspace } from '@/components/planning/planning-workspace';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { listDepartments, listShiftKeys } from '@/features/config/queries';
import {
  getPlan,
  getPlanInputs,
  getRotationRecords,
  listCallOffs,
  listPlanAssignments,
  listPlanDockDoors,
  listSpecialAssignments,
} from '@/features/planning/queries';

export default async function PlanWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(PLANNER_ROLES);
  const { id } = await params;

  const plan = await getPlan(id);
  if (!plan) notFound();

  const [
    inputs,
    assignments,
    callOffs,
    specials,
    activeDoorIds,
    rotationRecords,
    departments,
    shiftKeys,
  ] = await Promise.all([
    getPlanInputs(plan.departmentId, plan.shiftKeyId),
    listPlanAssignments(id),
    listCallOffs(id),
    listSpecialAssignments(id),
    listPlanDockDoors(id),
    getRotationRecords(plan.departmentId, plan.shiftKeyId, plan.planDate, 30),
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
        description={`Plan for ${plan.planDate}`}
      />
      <PlanningWorkspace
        plan={plan}
        deptKind={deptKind}
        inputs={inputs}
        assignments={assignments}
        callOffs={callOffs}
        specials={specials}
        activeDoorIds={activeDoorIds}
        rotationRecords={rotationRecords}
      />
    </>
  );
}
