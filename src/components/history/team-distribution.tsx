import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui';
import type { TaskDistribution } from '@/features/history/analytics';

interface TeamDistributionProps {
  distribution: TaskDistribution[];
  taskName: Map<string, string>;
  nameOf: Map<string, string>;
}

/** Per-task counts across the team — highlights assignment imbalances (PRD §9). */
export function TeamDistribution({
  distribution,
  taskName,
  nameOf,
}: TeamDistributionProps) {
  if (distribution.length === 0) {
    return (
      <EmptyState
        title="No planned history in this range"
        description="Publish plans and adjust the filters to see how work is distributed across the team."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {distribution.map((task) => {
        const max = task.perAssociate[0]?.count ?? 1;
        return (
          <Card key={task.taskTypeId ?? 'none'}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">
                {task.taskTypeId
                  ? (taskName.get(task.taskTypeId) ?? '—')
                  : 'No task'}
                <span className="text-foreground-subtle ml-1 font-normal">
                  ({task.total})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {task.perAssociate.map((a) => (
                <div key={a.associateId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">
                      {nameOf.get(a.associateId) ?? '—'}
                    </span>
                    <span className="text-foreground-muted tabular-nums">
                      {a.count}
                    </span>
                  </div>
                  <div className="bg-surface-raised h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(a.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
