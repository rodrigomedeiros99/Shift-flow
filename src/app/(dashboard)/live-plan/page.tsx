import Link from 'next/link';
import { Activity } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent, EmptyState } from '@/components/ui';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { listDepartments, listShiftKeys } from '@/features/config/queries';
import { listPublishedTodayPlans } from '@/features/live/queries';

export default async function LivePlanPage() {
  await requireRole(PLANNER_ROLES);
  const [plans, departments, shiftKeys] = await Promise.all([
    listPublishedTodayPlans(),
    listDepartments(),
    listShiftKeys(),
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const keyName = new Map(shiftKeys.map((k) => [k.id, k.name]));

  return (
    <>
      <PageHeader
        title="Live plan"
        description="Run today's published plans on the floor: move, switch, complete, and reassign labor in real time."
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No published plans to run"
          description="Publish a plan from Create Plan, then manage it live here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/live-plan/${plan.id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground font-medium">
                      {deptName.get(plan.departmentId) ?? '—'}
                    </p>
                    <p className="text-foreground-muted text-sm">
                      {keyName.get(plan.shiftKeyId) ?? '—'}
                    </p>
                  </div>
                  <Badge tone="success">Live</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
