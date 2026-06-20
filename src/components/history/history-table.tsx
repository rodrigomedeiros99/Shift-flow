import { Badge, Card, CardContent, EmptyState } from '@/components/ui';
import { ACTIVITY_ACTION_LABELS } from '@/lib/constants/assignments';
import { formatDateUS } from '@/lib/utils/date';
import type { HistoryRow } from '@/features/history/queries';

interface HistoryTableProps {
  rows: HistoryRow[];
  nameOf: Map<string, string>;
  taskName: Map<string, string>;
  equipName: Map<string, string>;
  deptName: Map<string, string>;
  keyName: Map<string, string>;
  actorName: Map<string, string>;
}

const actionLabel = (action: string) =>
  action === 'Planned'
    ? '—'
    : (ACTIVITY_ACTION_LABELS[action as keyof typeof ACTIVITY_ACTION_LABELS] ??
      action);

const COLS = [
  'Date',
  'Associate',
  'Department',
  'Key',
  'Task',
  'Equipment',
  'Source',
  'Action',
  'By',
];

/** Detailed, unified Planned + Activity history table (request H.2/H.3). */
export function HistoryTable({
  rows,
  nameOf,
  taskName,
  equipName,
  deptName,
  keyName,
  actorName,
}: HistoryTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No history for these filters"
        description="Publish plans and run them live to build history, then adjust the filters."
      />
    );
  }

  const cell = (map: Map<string, string>, id: string | null, dash = '—') =>
    id ? (map.get(id) ?? dash) : dash;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-border bg-surface-raised/50 border-b">
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c}
                    className="text-foreground-muted px-3 py-3 font-medium whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-border border-b last:border-0">
                  <td className="text-foreground-muted px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {formatDateUS(r.date)}
                  </td>
                  <td className="text-foreground px-3 py-2.5 font-medium whitespace-nowrap">
                    {cell(nameOf, r.associateId)}
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5">
                    {cell(deptName, r.departmentId)}
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5">
                    {cell(keyName, r.shiftKeyId)}
                  </td>
                  <td className="text-foreground px-3 py-2.5">
                    {cell(taskName, r.taskTypeId)}
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5">
                    {cell(equipName, r.equipmentId)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={r.source === 'Planned' ? 'primary' : 'info'}>
                      {r.source}
                    </Badge>
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5">
                    {actionLabel(r.action)}
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5">
                    {cell(actorName, r.actorId)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
