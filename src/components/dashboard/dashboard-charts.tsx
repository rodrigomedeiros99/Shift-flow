'use client';

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
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

const STATUS_COLORS = [
  '#2563eb',
  '#16a34a',
  '#0891b2',
  '#d97706',
  '#9333ea',
  '#f96302',
  '#6b7280',
];

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-foreground)',
  fontSize: 12,
};

/** Task distribution (bar) + associates-by-status (donut) — Recharts. */
export function DashboardCharts({
  byTask,
  byStatus,
}: {
  byTask: Datum[];
  byStatus: Datum[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Task distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {byTask.length === 0 ? (
            <EmptyState
              title="No assignments"
              description="Generate or publish a plan to see task distribution."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byTask}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: 'var(--color-foreground-muted)',
                    }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 11,
                      fill: 'var(--color-foreground-muted)',
                    }}
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

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Associates by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus.length === 0 ? (
            <EmptyState
              title="No assignments"
              description="Status breakdown appears once associates are assigned."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {byStatus.map((_, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                {byStatus.map((s, i) => (
                  <li
                    key={s.label}
                    className="text-foreground-muted flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[i % STATUS_COLORS.length],
                      }}
                    />
                    {s.label} ({s.value})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
