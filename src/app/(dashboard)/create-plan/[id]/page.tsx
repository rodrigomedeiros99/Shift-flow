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
  listPlanDockDoorRows,
  listSpecialAssignments,
  listStaffingNeeds,
  listUphCalculations,
} from '@/features/planning/queries';
import { formatDateUS } from '@/lib/utils/date';

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
    activeDoors,
    staffingNeeds,
    uphCalculations,
    rotationRecords,
    departments,
    shiftKeys,
  ] = await Promise.all([
    getPlanInputs(plan.departmentId, plan.shiftKeyId),
    listPlanAssignments(id),
    listCallOffs(id),
    listSpecialAssignments(id),
    listPlanDockDoorRows(id),
    listStaffingNeeds(id),
    listUphCalculations(id),
    getRotationRecords(plan.departmentId, plan.shiftKeyId, plan.planDate, 30),
    listDepartments(),
    listShiftKeys(),
  ]);

  const department = departments.find((d) => d.id === plan.departmentId);
  const deptName = department?.name ?? 'Plan';
  const deptKind = department?.kind ?? 'other';
  const shiftKey = shiftKeys.find((k) => k.id === plan.shiftKeyId);
  const keyName = shiftKey?.name ?? '';

  return (
    <>
      <PageHeader
        title={`${deptName} — ${keyName}`}
        description={`Plan for ${formatDateUS(plan.planDate)}`}
      />
      <PlanningWorkspace
        plan={plan}
        deptKind={deptKind}
        inputs={inputs}
        assignments={assignments}
        callOffs={callOffs}
        specials={specials}
        activeDoors={activeDoors}
        staffingNeeds={staffingNeeds}
        uphCalculations={uphCalculations}
        shiftHours={shiftKey?.productiveHours ?? null}
        rotationRecords={rotationRecords}
      />
    </>
  );
}
