import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import {
  ACTIVITY_ACTION_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from '@/lib/constants/assignments';
import type { RotationVariety } from '@/features/history/analytics';
import type { PlannedRow } from '@/features/history/queries';
import type { ActivityHistory } from '@/types/domain';

interface AssociateHistoryProps {
  associateName: string;
  planned: PlannedRow[];
  activity: ActivityHistory[];
  variety: RotationVariety;
  taskName: Map<string, string>;
  equipName: Map<string, string>;
  doorName: Map<string, string>;
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * One associate's history (PRD §9 / §4.1): Planned Assignment History and the
 * Activity Timeline shown as two clearly SEPARATE panels, plus a descriptive
 * rotation badge.
 */
export function AssociateHistory({
  associateName,
  planned,
  activity,
  variety,
  taskName,
  equipName,
  doorName,
}: AssociateHistoryProps) {
  const plannedDetail = (r: PlannedRow) =>
    [
      r.taskTypeId ? taskName.get(r.taskTypeId) : null,
      r.equipmentId ? equipName.get(r.equipmentId) : null,
      r.dockDoorId ? `Door ${doorName.get(r.dockDoorId) ?? '—'}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '—';

  const activityDetail = (a: ActivityHistory) => {
    if (a.actionType === 'status_changed') {
      return a.reason
        ? ASSIGNMENT_STATUS_LABELS[a.reason as AssignmentStatus]
        : '';
    }
    const to = [
      a.toTaskTypeId ? taskName.get(a.toTaskTypeId) : null,
      a.toDockDoorId ? `Door ${doorName.get(a.toDockDoorId) ?? '—'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const from = [
      a.fromTaskTypeId ? taskName.get(a.fromTaskTypeId) : null,
      a.fromDockDoorId ? `Door ${doorName.get(a.fromDockDoorId) ?? '—'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return to || from || '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-foreground text-lg font-semibold">
          {associateName}
        </h2>
        <Badge
          tone={variety.tone}
          title={`${variety.distinctTasks} distinct tasks over ${variety.totalDays} planned days`}
        >
          Rotation: {variety.label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              Planned assignment history
              <span className="text-foreground-subtle ml-1 font-normal">
                ({planned.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {planned.length === 0 ? (
              <p className="text-foreground-subtle text-sm">
                No planned assignments in this range.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {planned.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground-subtle tabular-nums">
                      {r.planDate}
                    </span>
                    <span className="text-foreground flex-1 text-right">
                      {plannedDetail(r)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              Activity timeline
              <span className="text-foreground-subtle ml-1 font-normal">
                ({activity.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {activity.length === 0 ? (
              <p className="text-foreground-subtle text-sm">
                No live activity in this range.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-foreground-subtle tabular-nums">
                      {stamp(a.changedAt)}
                    </span>
                    <span className="text-foreground-muted">
                      <span className="text-foreground font-medium">
                        {ACTIVITY_ACTION_LABELS[a.actionType]}
                      </span>{' '}
                      {activityDetail(a)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
