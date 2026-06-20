import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { PlanSetupForm } from '@/components/planning/plan-setup-form';
import { DraftDeleteButton } from '@/components/planning/draft-delete-button';
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
                <Card
                  key={plan.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="flex items-center justify-between gap-2">
                    <Link
                      href={`/create-plan/${plan.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="text-foreground truncate font-medium">
                        {deptName.get(plan.departmentId) ?? '—'}
                      </p>
                      <p className="text-foreground-muted truncate text-sm">
                        {keyName.get(plan.shiftKeyId) ?? '—'}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          plan.status === 'published'
                            ? 'success'
                            : plan.status === 'draft'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {plan.status.charAt(0).toUpperCase() +
                          plan.status.slice(1)}
                      </Badge>
                      {plan.status === 'draft' ? (
                        <DraftDeleteButton planId={plan.id} />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
