'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui';

interface Datum {
  label: string;
  value: number;
}

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-foreground)',
  fontSize: 12,
};

function ChartCard({ title, data }: { title: string; data: Datum[] }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            title="No data"
            description="Adjust the filters to see results."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-foreground-muted)' }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--color-foreground-muted)' }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ opacity: 0.1 }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Task usage + associate usage distributions (Recharts) for History. */
export function HistoryCharts({
  taskUsage,
  associateUsage,
}: {
  taskUsage: Datum[];
  associateUsage: Datum[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Task usage (planned)" data={taskUsage} />
      <ChartCard title="Associate usage (planned)" data={associateUsage} />
    </div>
  );
}
