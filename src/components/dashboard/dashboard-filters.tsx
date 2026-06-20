'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, Input, Select } from '@/components/ui';
import { Field } from '@/components/config/field';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import type { ShiftKey } from '@/types/domain';

const LIVE_TABLES = [
  'daily_plans',
  'assignments',
  'call_offs',
  'special_assignments',
] as const;

/**
 * Dashboard filter bar (department kind / key / date), URL-driven, plus a live
 * subscription so the KPIs and charts refresh as plans change.
 */
export function DashboardFilters({
  shiftKeys,
  current,
}: {
  shiftKeys: ShiftKey[];
  current: { kind: string; key: string; date: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useRealtimeRefresh('dashboard', LIVE_TABLES);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <Card>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department" htmlFor="d-kind">
            <Select
              id="d-kind"
              value={current.kind}
              onChange={(e) => setParam('kind', e.target.value)}
            >
              <option value="">All departments</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </Select>
          </Field>
          <Field label="Key" htmlFor="d-key">
            <Select
              id="d-key"
              value={current.key}
              onChange={(e) => setParam('key', e.target.value)}
            >
              <option value="">All keys</option>
              {shiftKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="d-date">
            <Input
              id="d-date"
              type="date"
              value={current.date}
              onChange={(e) => setParam('date', e.target.value)}
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
