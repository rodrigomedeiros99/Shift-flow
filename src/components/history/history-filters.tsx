'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, Input, Select } from '@/components/ui';
import { Field } from '@/components/config/field';
import {
  RANGE_PRESETS,
  RANGE_PRESET_LABELS,
  type RangePreset,
} from '@/features/history/range';
import type { HistoryFilterOptions } from '@/features/history/queries';

interface HistoryFiltersProps {
  options: HistoryFilterOptions;
  current: {
    dept: string;
    key: string;
    assoc: string;
    task: string;
    equip: string;
    range: RangePreset;
    from: string;
    to: string;
  };
}

const fullName = (first: string, last: string) => `${first} ${last}`;

/**
 * History filter bar (PRD §9). All state lives in the URL so a report is
 * shareable/bookmarkable; the server page reads the params and re-queries.
 */
export function HistoryFilters({ options, current }: HistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Department" htmlFor="h-dept">
            <Select
              id="h-dept"
              value={current.dept}
              onChange={(e) => setParam('dept', e.target.value)}
            >
              <option value="">All departments</option>
              {options.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Key" htmlFor="h-key">
            <Select
              id="h-key"
              value={current.key}
              onChange={(e) => setParam('key', e.target.value)}
            >
              <option value="">All keys</option>
              {options.shiftKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Associate" htmlFor="h-assoc">
            <Select
              id="h-assoc"
              value={current.assoc}
              onChange={(e) => setParam('assoc', e.target.value)}
            >
              <option value="">All associates (team view)</option>
              {options.associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {fullName(a.firstName, a.lastName)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Task" htmlFor="h-task">
            <Select
              id="h-task"
              value={current.task}
              onChange={(e) => setParam('task', e.target.value)}
            >
              <option value="">All tasks</option>
              {options.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Equipment" htmlFor="h-equip">
            <Select
              id="h-equip"
              value={current.equip}
              onChange={(e) => setParam('equip', e.target.value)}
            >
              <option value="">All equipment</option>
              {options.equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date range" htmlFor="h-range">
            <Select
              id="h-range"
              value={current.range}
              onChange={(e) => setParam('range', e.target.value)}
            >
              {RANGE_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {RANGE_PRESET_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>

          {current.range === 'custom' ? (
            <>
              <Field label="From" htmlFor="h-from">
                <Input
                  id="h-from"
                  type="date"
                  value={current.from}
                  onChange={(e) => setParam('from', e.target.value)}
                />
              </Field>
              <Field label="To" htmlFor="h-to">
                <Input
                  id="h-to"
                  type="date"
                  value={current.to}
                  onChange={(e) => setParam('to', e.target.value)}
                />
              </Field>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
