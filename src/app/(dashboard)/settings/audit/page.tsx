import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, EmptyState } from '@/components/ui';
import { CONFIG_MANAGER_ROLES, requireRole } from '@/features/auth/queries';
import {
  listFacilityProfileNames,
  listRecentAudit,
} from '@/features/audit/queries';

const ACTION_LABELS: Record<string, string> = {
  create_plan: 'Created plan',
  publish_plan: 'Published plan',
  close_shift: 'Closed shift',
  moved_associate: 'Moved associate',
  switched_assignment: 'Switched assignment',
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default async function AuditPage() {
  await requireRole(CONFIG_MANAGER_ROLES);
  const [entries, profiles] = await Promise.all([
    listRecentAudit(100),
    listFacilityProfileNames(),
  ]);
  const nameOf = new Map(profiles.map((p) => [p.id, p.fullName]));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="The 100 most recent recorded actions in this facility. Append-only."
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          description="Creating, publishing, and running plans live will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-border bg-surface-raised/50 border-b">
                  <tr>
                    <th className="text-foreground-muted px-4 py-3 font-medium">
                      When
                    </th>
                    <th className="text-foreground-muted px-4 py-3 font-medium">
                      User
                    </th>
                    <th className="text-foreground-muted px-4 py-3 font-medium">
                      Action
                    </th>
                    <th className="text-foreground-muted px-4 py-3 font-medium">
                      Entity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-border border-b last:border-0"
                    >
                      <td className="text-foreground-muted px-4 py-3 whitespace-nowrap tabular-nums">
                        {stamp(e.createdAt)}
                      </td>
                      <td className="text-foreground px-4 py-3">
                        {e.userId ? (nameOf.get(e.userId) ?? '—') : 'System'}
                      </td>
                      <td className="text-foreground px-4 py-3 font-medium">
                        {ACTION_LABELS[e.actionType] ?? e.actionType}
                      </td>
                      <td className="text-foreground-muted px-4 py-3">
                        {e.entityType ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
