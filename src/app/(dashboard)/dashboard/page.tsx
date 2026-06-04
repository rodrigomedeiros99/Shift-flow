import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, Button, Card, CardContent, EmptyState } from '@/components/ui';
import { listDepartments, listShiftKeys } from '@/features/config/queries';
import { listTodayPlans } from '@/features/planning/queries';

export default async function DashboardPage() {
  const [todayPlans, departments, shiftKeys] = await Promise.all([
    listTodayPlans(),
    listDepartments(),
    listShiftKeys(),
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const keyName = new Map(shiftKeys.map((k) => [k.id, k.name]));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of today's labor plans and workforce allocation."
        actions={
          <Link href="/create-plan">
            <Button size="sm" className="gap-2">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Create plan
            </Button>
          </Link>
        }
      />

      {todayPlans.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No shift plans for today yet"
          description="Create an outbound plan to get started. Published plans will appear here and on TV Mode."
        />
      ) : (
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
                    tone={plan.status === 'published' ? 'success' : 'neutral'}
                  >
                    {plan.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
