import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui';
import { PLANNER_ROLES, requireRole } from '@/features/auth/queries';
import {
  listWeeklySchedules,
  listZones,
} from '@/features/load-priority/queries';
import { LpWeeklySchedule } from '@/components/load-priority/lp-weekly-schedule';
import { weekdayOf } from '@/features/load-priority/zones';
import { todayISO } from '@/lib/utils/date';

export default async function LoadPriorityWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireRole(PLANNER_ROLES);
  const { day } = await searchParams;
  const requested = day !== undefined ? Number(day) : NaN;
  const initialWeekday =
    Number.isInteger(requested) && requested >= 0 && requested <= 6
      ? requested
      : weekdayOf(todayISO());
  const [rows, zones] = await Promise.all([listWeeklySchedules(), listZones()]);

  return (
    <>
      <div className="mb-4">
        <Link href="/load-priority">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Load Priority
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Weekly Master Schedule"
        description="Recurring doors per weekday. Daily boards snapshot the active rows for that day — daily edits never change these defaults."
      />
      <LpWeeklySchedule
        rows={rows}
        zones={zones}
        initialWeekday={initialWeekday}
      />
    </>
  );
}
