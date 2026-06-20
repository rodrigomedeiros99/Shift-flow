import { PageHeader } from '@/components/layout/page-header';
import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryCharts } from '@/components/history/history-charts';
import { HistoryTable } from '@/components/history/history-table';
import { HistoryPagination } from '@/components/history/history-pagination';
import { HistoryExport } from '@/components/history/history-export';
import { requireRole, PLANNER_ROLES } from '@/features/auth/queries';
import {
  getHistoryFilterOptions,
  getHistoryRows,
  getPlannedHistory,
  type HistoryFilter,
} from '@/features/history/queries';
import type { HistoryExportData } from '@/features/history/export';
import { listFacilityProfileNames } from '@/features/audit/queries';
import { assignmentFrequency } from '@/features/history/analytics';
import {
  isRangePreset,
  resolveRange,
  type RangePreset,
} from '@/features/history/range';
import { ACTIVITY_ACTION_LABELS } from '@/lib/constants/assignments';
import { DEFAULT_FACILITY_NAME } from '@/lib/constants/app';
import { formatDateUS } from '@/lib/utils/date';

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
  const range = resolveRange(preset, param(sp, 'from'), param(sp, 'to'));
  const filter: HistoryFilter = {
    departmentId: param(sp, 'dept'),
    shiftKeyId: param(sp, 'key'),
    associateId: param(sp, 'assoc'),
    taskTypeId: param(sp, 'task'),
    equipmentId: param(sp, 'equip'),
    range,
  };

  const [rows, planned, profiles] = await Promise.all([
    getHistoryRows(filter),
    getPlannedHistory(filter),
    listFacilityProfileNames(),
  ]);

  const nameOf = new Map(
    options.associates.map((a) => [a.id, `${a.firstName} ${a.lastName}`]),
  );
  const taskName = new Map(options.tasks.map((t) => [t.id, t.name]));
  const equipName = new Map(options.equipment.map((e) => [e.id, e.name]));
  const deptName = new Map(options.departments.map((d) => [d.id, d.name]));
  const keyName = new Map(options.shiftKeys.map((k) => [k.id, k.name]));
  const actorName = new Map(profiles.map((p) => [p.id, p.fullName]));

  // Charts: task usage + associate usage from planned history.
  const taskUsage = assignmentFrequency(planned).map((r) => ({
    label: r.id ? (taskName.get(r.id) ?? '—') : 'No task',
    value: r.count,
  }));
  const assocCounts = new Map<string, number>();
  for (const p of planned)
    assocCounts.set(p.associateId, (assocCounts.get(p.associateId) ?? 0) + 1);
  const associateUsage = [...assocCounts.entries()]
    .map(([id, value]) => ({ label: nameOf.get(id) ?? '—', value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  // Export data: the FULL filtered set (not just the page), names resolved
  // server-side so the client component receives plain, serializable rows.
  const cell = (map: Map<string, string>, id: string | null) =>
    id ? (map.get(id) ?? '—') : '—';
  const actionLabel = (action: string) =>
    action === 'Planned'
      ? '—'
      : (ACTIVITY_ACTION_LABELS[
          action as keyof typeof ACTIVITY_ACTION_LABELS
        ] ?? action);

  const associateName = filter.associateId
    ? (nameOf.get(filter.associateId) ?? null)
    : null;

  const associateUsageFull = [...assocCounts.entries()]
    .map(([id, value]) => ({ label: nameOf.get(id) ?? '—', value }))
    .sort((a, b) => b.value - a.value);

  const exportData: HistoryExportData = {
    reportTitle: associateName
      ? `Associate History — ${associateName}`
      : 'ShiftFlow History',
    facilityName: DEFAULT_FACILITY_NAME,
    associateName,
    filters: [
      { label: 'Associate', value: associateName ?? 'All associates' },
      {
        label: 'Date range',
        value: `${formatDateUS(range.from)} – ${formatDateUS(range.to)}`,
      },
    ],
    rows: rows.map((r) => ({
      date: r.date,
      associate: cell(nameOf, r.associateId),
      department: cell(deptName, r.departmentId),
      key: cell(keyName, r.shiftKeyId),
      task: cell(taskName, r.taskTypeId),
      equipment: cell(equipName, r.equipmentId),
      source: r.source,
      action: actionLabel(r.action),
      by: cell(actorName, r.actorId),
    })),
    taskUsage,
    associateUsage: associateUsageFull,
  };

  // Pagination: 10 rows per page, server-side slice (only the page is rendered).
  const PAGE_SIZE = 10;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNum = Math.min(
    Math.max(1, Number(param(sp, 'page')) || 1),
    totalPages,
  );
  const pageRows = rows.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  const start = total === 0 ? 0 : (pageNum - 1) * PAGE_SIZE + 1;
  const end = Math.min(pageNum * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="History & reporting"
        description="Planned assignments and live activity. Filter by department, key, date, and associate."
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

        <HistoryCharts taskUsage={taskUsage} associateUsage={associateUsage} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-foreground text-lg font-semibold">
              Detailed history
              <span className="text-foreground-subtle ml-2 text-sm font-normal">
                {total} records
              </span>
            </h2>
            <HistoryExport data={exportData} />
          </div>
          <HistoryTable
            rows={pageRows}
            nameOf={nameOf}
            taskName={taskName}
            equipName={equipName}
            deptName={deptName}
            keyName={keyName}
            actorName={actorName}
          />
          {total > 0 ? (
            <HistoryPagination
              page={pageNum}
              totalPages={totalPages}
              total={total}
              start={start}
              end={end}
            />
          ) : null}
        </section>
      </div>
    </>
  );
}
