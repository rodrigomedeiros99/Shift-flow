import Link from 'next/link';
import { CalendarDays, MonitorPlay } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { PLANNER_ROLES, requireRole } from '@/features/auth/queries';
import { listShiftKeys } from '@/features/config/queries';
import {
  listBoards,
  weeklyCountsByWeekday,
} from '@/features/load-priority/queries';
import { LpCreatePanel } from '@/components/load-priority/lp-create-panel';
import { LpBoardList } from '@/components/load-priority/lp-board-list';
import {
  weekdayLabel,
  weekdayOf,
  WEEKDAYS_MON_FIRST,
} from '@/features/load-priority/zones';
import { formatDateUS, todayISO } from '@/lib/utils/date';

export default async function LoadPriorityPage() {
  await requireRole(PLANNER_ROLES);
  const [boards, shiftKeys, counts] = await Promise.all([
    listBoards(),
    listShiftKeys(),
    weeklyCountsByWeekday(),
  ]);
  const keyName = Object.fromEntries(shiftKeys.map((k) => [k.id, k.name]));
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Load Priority"
        description="A reusable weekly master schedule — review a day and publish it to the TV."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/load-priority/schedule">
              <Button variant="secondary" className="gap-2">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Weekly schedule
              </Button>
            </Link>
            <Link href="/load-priority-tv" target="_blank">
              <Button variant="secondary" className="gap-2">
                <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                Open TV
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="border-border bg-surface-raised/40 rounded-md border px-4 py-3">
          <p className="text-foreground text-sm font-medium">
            Today — {weekdayLabel(weekdayOf(today))}, {formatDateUS(today)}
          </p>
          <p className="text-foreground-muted text-xs">
            Create today’s draft to snapshot the weekly schedule, review it,
            then publish.
          </p>
        </div>

        <LpCreatePanel shiftKeys={shiftKeys} />

        <Card>
          <CardHeader>
            <CardTitle>Weekly schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {WEEKDAYS_MON_FIRST.map((d) => (
                <Link
                  key={d}
                  href={`/load-priority/schedule?day=${d}`}
                  className="group"
                >
                  <div className="border-border hover:border-primary/60 rounded-lg border p-3 text-center transition-colors">
                    <p className="text-foreground text-sm font-semibold">
                      {weekdayLabel(d)}
                    </p>
                    <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                      {counts[d] ?? 0}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      scheduled doors
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent boards</CardTitle>
          </CardHeader>
          <CardContent>
            <LpBoardList boards={boards} keyName={keyName} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
