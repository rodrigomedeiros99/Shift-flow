import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { CountRow } from '@/features/history/analytics';

interface CountTableProps {
  title: string;
  rows: CountRow[];
  resolve: (id: string | null) => string;
  emptyLabel?: string;
}

/** A labelled count list with proportional bars (frequency / equipment usage). */
export function CountTable({
  title,
  rows,
  resolve,
  emptyLabel = 'No data for this range.',
}: CountTableProps) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {rows.length === 0 ? (
          <p className="text-foreground-subtle text-sm">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id ?? 'none'} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{resolve(r.id)}</span>
                  <span className="text-foreground-muted tabular-nums">
                    {r.count}
                  </span>
                </div>
                <div className="bg-surface-raised h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
