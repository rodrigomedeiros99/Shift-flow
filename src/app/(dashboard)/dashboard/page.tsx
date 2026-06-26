import Link from 'next/link';
import { CalendarPlus, Users, UserCheck, UserX, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, Button, Card, CardContent, EmptyState } from '@/components/ui';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { DashboardRealtime } from '@/components/dashboard/dashboard-realtime';
import { RecentActivity } from '@/components/live/recent-activity';
import { DraftDeleteButton } from '@/components/planning/draft-delete-button';
import { listShiftKeys } from '@/features/config/queries';
import {
  getDashboardData,
  getRecentActivity,
  type DashboardFilter,
} from '@/features/dashboard/queries';
import { formatDateUS, todayISO } from '@/lib/utils/date';
import type { DepartmentKind } from '@/lib/constants/departments';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const str = (
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string => {
  const v = sp[key];
  return typeof v === 'string' ? v : '';
};

const KPIS: {
  key: 'associates' | 'assigned' | 'callOffs' | 'overtime';
  label: string;
  icon: LucideIcon;
}[] = [
  { key: 'associates', label: 'Total associates', icon: Users },
  { key: 'assigned', label: 'Assigned', icon: UserCheck },
  { key: 'callOffs', label: 'Call-offs', icon: UserX },
  { key: 'overtime', label: 'Overtime', icon: Clock },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [sp, shiftKeys, recent] = await Promise.all([
    searchParams,
    listShiftKeys(),
    getRecentActivity(),
  ]);

  const kindRaw = str(sp, 'kind');
  const kind: '' | DepartmentKind =
    kindRaw === 'inbound' || kindRaw === 'outbound' ? kindRaw : '';
  const filter: DashboardFilter = {
    deptKind: kind,
    shiftKeyId: str(sp, 'key'),
    date: str(sp, 'date') || todayISO(),
  };
  const data = await getDashboardData(filter);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of labor plans, allocation, and workforce status."
        actions={
          <Link href="/create-plan">
            <Button size="sm" className="gap-2">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Create plan
            </Button>
          </Link>
        }
      />

      <DashboardRealtime />

      <div className="space-y-6">
        <DashboardFilters
          shiftKeys={shiftKeys}
          current={{ kind, key: filter.shiftKeyId, date: filter.date }}
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map(({ key, label, icon: Icon }) => (
            <Card key={key}>
              <CardContent className="flex items-center gap-4">
                <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-foreground text-2xl font-semibold tabular-nums">
                    {data.totals[key]}
                  </p>
                  <p className="text-foreground-muted text-xs">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DashboardCharts byTask={data.byTask} byStatus={data.byStatus} />

        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold">
            Plans for {formatDateUS(data.date)}
          </h2>
          {data.plans.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No plans for this scope"
              description="Adjust the filters or create a plan."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.plans.map((plan) => {
                const live = plan.status === 'published';
                const href = live
                  ? `/live-plan/${plan.id}`
                  : `/create-plan/${plan.id}`;
                return (
                  <Card
                    key={plan.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-foreground font-medium">
                            {plan.departmentName}
                          </p>
                          <p className="text-foreground-muted text-sm">
                            {plan.keyName}
                          </p>
                        </div>
                        <Badge
                          tone={
                            plan.status === 'published'
                              ? 'success'
                              : plan.status === 'closed'
                                ? 'neutral'
                                : 'warning'
                          }
                        >
                          {plan.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/create-plan/${plan.id}`}>
                          <Button size="sm" variant="outline">
                            Edit plan
                          </Button>
                        </Link>
                        {live ? (
                          <Link href={href}>
                            <Button size="sm" variant="secondary">
                              Manage live
                            </Button>
                          </Link>
                        ) : null}
                        {plan.status === 'draft' ? (
                          <DraftDeleteButton planId={plan.id} />
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold">
            Recent activity
          </h2>
          <RecentActivity
            items={recent.items}
            nameOf={recent.nameOf}
            taskName={recent.taskName}
            doorName={recent.doorName}
            planContext={recent.planContext}
            title="Today's activity"
          />
        </section>
      </div>
    </>
  );
}
