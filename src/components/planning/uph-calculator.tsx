'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';

export interface UphCalcRow {
  taskId: string;
  taskName: string;
  usesUph: boolean;
  /** Configured rate, or null when not set in Settings. */
  uph: number | null;
  units: number;
  recommended: number | null;
  /** Inbound unload: staffed by dock doors, so Apply doesn't target staffing. */
  doorDriven: boolean;
}

interface UphCalculatorProps {
  rows: UphCalcRow[];
  shiftHours: number | null;
  totalRecommended: number;
  totalFinal: number;
  pending: boolean;
  onUnitsChange: (taskId: string, units: number) => void;
  onApply: (taskId: string) => void;
  onApplyAll: () => void;
}

const TH =
  'text-foreground-muted px-3 py-2 text-left text-xs font-medium whitespace-nowrap';
const TD = 'px-3 py-2 align-middle whitespace-nowrap';

/**
 * UPH Labor Calculator (recommendation tool) shown above Staffing Needs. The
 * supervisor enters units per task; the recommendation is
 * CEIL(units / (UPH × shift hours)). Apply fills that task's staffing number;
 * the supervisor can still override. Never forces a value, never blocks.
 */
export function UphCalculator({
  rows,
  shiftHours,
  totalRecommended,
  totalFinal,
  pending,
  onUnitsChange,
  onApply,
  onApplyAll,
}: UphCalculatorProps) {
  const anyRecommendation = rows.some((r) => r.recommended !== null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          UPH labor calculator
          <span className="text-foreground-subtle ml-2 text-sm font-normal">
            recommendation only
          </span>
        </CardTitle>
        <Button
          size="sm"
          variant="secondary"
          onClick={onApplyAll}
          disabled={pending || !anyRecommendation}
        >
          Apply all recommendations
        </Button>
      </CardHeader>
      <CardContent>
        {shiftHours === null ? (
          <p className="border-warning/40 bg-warning/10 text-foreground mb-4 rounded-md border px-3 py-2 text-sm">
            This shift key has no productive hours set. Add it under Settings →
            Shift keys to get recommendations.
          </p>
        ) : null}

        <div className="border-border overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-border bg-surface-raised/50 border-b">
              <tr>
                <th className={TH}>Task</th>
                <th className={TH}>Units</th>
                <th className={TH}>UPH</th>
                <th className={TH}>Shift hours</th>
                <th className={TH}>Recommended</th>
                <th className={TH}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const notConfigured = !r.usesUph || r.uph === null;
                return (
                  <tr
                    key={r.taskId}
                    className="border-border border-b last:border-0"
                  >
                    <td className={`${TD} text-foreground font-medium`}>
                      {r.taskName}
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Units for ${r.taskName}`}
                        value={r.units === 0 ? '' : String(r.units)}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          onUnitsChange(
                            r.taskId,
                            Number.parseInt(
                              e.target.value.replace(/[^0-9]/g, '') || '0',
                              10,
                            ),
                          )
                        }
                        className="border-border bg-background text-foreground focus-visible:border-primary h-9 w-24 rounded-md border px-2 text-right text-sm tabular-nums focus-visible:outline-none"
                      />
                    </td>
                    <td className={`${TD} text-foreground-muted tabular-nums`}>
                      {notConfigured ? (
                        <span className="text-warning">Not configured</span>
                      ) : (
                        r.uph
                      )}
                    </td>
                    <td className={`${TD} text-foreground-muted tabular-nums`}>
                      {shiftHours ?? '—'}
                    </td>
                    <td className={`${TD} tabular-nums`}>
                      {r.recommended !== null ? (
                        <span className="text-foreground text-base font-bold">
                          {r.recommended}
                        </span>
                      ) : (
                        <span className="text-foreground-subtle">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      {r.doorDriven ? (
                        <span className="text-foreground-subtle text-xs">
                          Staffed by doors
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending || r.recommended === null}
                          onClick={() => onApply(r.taskId)}
                        >
                          Apply
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-foreground-muted mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Total recommended:{' '}
            <span className="text-foreground font-semibold tabular-nums">
              {totalRecommended}
            </span>
          </span>
          <span>
            Total final staffing:{' '}
            <span className="text-foreground font-semibold tabular-nums">
              {totalFinal}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
