import { PageHeader } from '@/components/layout/page-header';
import { CountTable } from '@/components/history/count-table';
import { HistoryFilters } from '@/components/history/history-filters';
import { TeamDistribution } from '@/components/history/team-distribution';
import { AssociateHistory } from '@/components/history/associate-history';
import { SpecialSummaryPanel } from '@/components/history/special-summary';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import {
  getActivityHistory,
  getHistoryFilterOptions,
  getPlannedHistory,
  getSpecialSummary,
  type HistoryFilter,
} from '@/features/history/queries';
import {
  assignmentFrequency,
  equipmentUsage,
  rotationVariety,
  teamDistribution,
} from '@/features/history/analytics';
import {
  isRangePreset,
  resolveRange,
  type RangePreset,
} from '@/features/history/range';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const param = (
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string => {
  const v = sp[key];
  return typeof v === 'string' ? v : '';
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(PLANNER_ROLES);
  const [sp, options] = await Promise.all([
    searchParams,
    getHistoryFilterOptions(),
  ]);

  const rangeRaw = param(sp, 'range');
  const preset: RangePreset = isRangePreset(rangeRaw) ? rangeRaw : 'last7';
  const from = param(sp, 'from');
  const to = param(sp, 'to');
  const range = resolveRange(preset, from, to);

  const filter: HistoryFilter = {
    departmentId: param(sp, 'dept'),
    shiftKeyId: param(sp, 'key'),
    associateId: param(sp, 'assoc'),
    taskTypeId: param(sp, 'task'),
    equipmentId: param(sp, 'equip'),
    range,
  };

  const [planned, activity, special] = await Promise.all([
    getPlannedHistory(filter),
    getActivityHistory(filter),
    getSpecialSummary(filter),
  ]);

  // Name lookups (built once, passed to the read-only display components).
  const nameOf = new Map(
    options.associates.map((a) => [a.id, `${a.firstName} ${a.lastName}`]),
  );
  const taskName = new Map(options.tasks.map((t) => [t.id, t.name]));
  const equipName = new Map(options.equipment.map((e) => [e.id, e.name]));
  const doorName = new Map(options.dockDoors.map((d) => [d.id, d.doorNumber]));

  const isAssociateView = filter.associateId !== '';

  return (
    <>
      <PageHeader
        title="History & reporting"
        description="Review planned assignments and live activity. Filter by department, key, date, and associate."
      />

      <div className="space-y-6">
        <HistoryFilters
          options={options}
          current={{
            dept: filter.departmentId,
            key: filter.shiftKeyId,
            assoc: filter.associateId,
            task: filter.taskTypeId,
            equip: filter.equipmentId,
            range: preset,
            from: range.from,
            to: range.to,
          }}
        />

        {isAssociateView ? (
          <>
            <AssociateHistory
              associateName={nameOf.get(filter.associateId) ?? 'Associate'}
              planned={planned}
              activity={activity}
              variety={rotationVariety(planned)}
              taskName={taskName}
              equipName={equipName}
              doorName={doorName}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <CountTable
                title="Assignment frequency"
                rows={assignmentFrequency(planned)}
                resolve={(id) => (id ? (taskName.get(id) ?? '—') : 'No task')}
              />
              <CountTable
                title="Equipment usage"
                rows={equipmentUsage(planned)}
                resolve={(id) => (id ? (equipName.get(id) ?? '—') : 'None')}
              />
            </div>
            <SpecialSummaryPanel summary={special} />
          </>
        ) : (
          <>
            <SpecialSummaryPanel summary={special} />
            <TeamDistribution
              distribution={teamDistribution(planned)}
              taskName={taskName}
              nameOf={nameOf}
            />
          </>
        )}
      </div>
    </>
  );
}
