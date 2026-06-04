import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { SpecialSummary } from '@/features/history/queries';
import {
  SPECIAL_ASSIGNMENT_TYPES,
  type SpecialAssignmentType,
} from '@/lib/constants/assignments';

const LABELS: Record<SpecialAssignmentType, string> = {
  overtime: 'Overtime',
  middle_mile: 'Middle Mile',
  icqa_support: 'ICQA Support',
  training: 'Training',
  support_outbound: 'Support Outbound',
};

/** Overtime / Training / Middle Mile / ICQA / Support counts (PRD §9). */
export function SpecialSummaryPanel({ summary }: { summary: SpecialSummary }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Special assignments</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SPECIAL_ASSIGNMENT_TYPES.map((type) => (
            <div
              key={type}
              className="border-border rounded-md border p-3 text-center"
            >
              <dd className="text-foreground text-2xl font-semibold tabular-nums">
                {summary[type]}
              </dd>
              <dt className="text-foreground-muted mt-1 text-xs">
                {LABELS[type]}
              </dt>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
