import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { PlanSetupForm } from '@/components/planning/plan-setup-form';
import { Badge, Card, CardContent } from '@/components/ui';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import { listDepartments, listShiftKeys } from '@/features/config/queries';
import { listTodayPlans } from '@/features/planning/queries';

export default async function CreatePlanPage() {
  await requireRole(PLANNER_ROLES);
  const [departments, shiftKeys, todayPlans] = await Promise.all([
    listDepartments(),
    listShiftKeys(),
    listTodayPlans(),
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const keyName = new Map(shiftKeys.map((k) => [k.id, k.name]));

  return (
    <>
      <PageHeader
        title="Create plan"
        description="Start an outbound plan: pick a department, key, and date, then run the morning setup."
      />

      <div className="space-y-8">
        <PlanSetupForm
          departments={departments.filter((d) => d.active)}
          shiftKeys={shiftKeys.filter((k) => k.active)}
        />

        {todayPlans.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold">
              Today&apos;s plans
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {todayPlans.map((plan) => (
                <Link key={plan.id} href={`/create-plan/${plan.id}`}>
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
                      <Badge
                        tone={
                          plan.status === 'published' ? 'success' : 'neutral'
                        }
                      >
                        {plan.status === 'published' ? 'Published' : 'Draft'}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
