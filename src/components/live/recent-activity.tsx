import Link from 'next/link';
import {
  ACTIVITY_ACTION_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from '@/lib/constants/assignments';
import type { ActivityHistory } from '@/types/domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface RecentActivityProps {
  items: ActivityHistory[];
  nameOf: Map<string, string>;
  taskName: Map<string, string>;
  doorName: Map<string, string>;
  /** Optional title override (defaults to "Recent activity"). */
  title?: string;
  /**
   * Optional plan context per `dailyPlanId`. When provided (Dashboard, where
   * activity spans plans) each row shows a linked department · key label.
   */
  planContext?: Map<string, { label: string; href: string }>;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function detail(
  a: ActivityHistory,
  taskName: Map<string, string>,
  doorName: Map<string, string>,
): string {
  const target = (taskId: string | null, doorId: string | null) =>
    [
      taskId ? taskName.get(taskId) : null,
      doorId ? `Door ${doorName.get(doorId) ?? '—'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  switch (a.actionType) {
    case 'status_changed':
      return a.reason
        ? ASSIGNMENT_STATUS_LABELS[a.reason as AssignmentStatus]
        : '';
    case 'assigned':
      return target(a.toTaskTypeId, a.toDockDoorId);
    case 'moved':
    case 'switched': {
      const to = target(a.toTaskTypeId, a.toDockDoorId);
      return to ? `→ ${to}` : '';
    }
    case 'completed':
    case 'removed':
      return target(a.fromTaskTypeId, a.fromDockDoorId);
    default:
      return '';
  }
}

/** The shift's in-day timeline (newest first) — proof that activity is logged. */
export function RecentActivity({
  items,
  nameOf,
  taskName,
  doorName,
  title = 'Recent activity',
  planContext,
}: RecentActivityProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {items.length === 0 ? (
          <p className="text-foreground-subtle text-sm">
            No live changes yet. Moves, switches, and completions appear here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((a) => {
              const ctx = planContext?.get(a.dailyPlanId);
              return (
                <li key={a.id} className="flex items-baseline gap-2 text-sm">
                  <span className="text-foreground-subtle tabular-nums">
                    {time(a.changedAt)}
                  </span>
                  <span className="text-foreground-muted">
                    <span className="text-foreground font-medium">
                      {nameOf.get(a.associateId) ?? '—'}
                    </span>{' '}
                    {ACTIVITY_ACTION_LABELS[a.actionType].toLowerCase()}{' '}
                    {detail(a, taskName, doorName)}
                    {ctx ? (
                      <>
                        {' · '}
                        <Link
                          href={ctx.href}
                          className="text-primary hover:underline"
                        >
                          {ctx.label}
                        </Link>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
