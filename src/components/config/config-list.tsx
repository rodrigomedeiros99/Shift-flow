'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button, EmptyState, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

export interface Column<T> {
  header: string;
  cell: (item: T) => ReactNode;
  /** Optional extra classes for the cell (e.g. alignment, width). */
  className?: string;
}

interface ConfigListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  /** Text searched against the query (case-insensitive). */
  searchText: (item: T) => string;
  isActive: (item: T) => boolean;
  columns: Column<T>[];
  /** Per-row action buttons (edit, activate/deactivate). */
  renderActions: (item: T) => ReactNode;
  onAdd: () => void;
  addLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription?: string;
}

type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Reusable management list: search box, active/inactive filter, and a table
 * with per-row actions (§5: cards/tables where appropriate, search & filters,
 * empty states). Shared by every configuration module to avoid duplication.
 */
export function ConfigList<T>({
  items,
  getKey,
  searchText,
  isActive,
  columns,
  renderActions,
  onAdd,
  addLabel,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
}: ConfigListProps<T>) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (status === 'active' && !isActive(item)) return false;
      if (status === 'inactive' && isActive(item)) return false;
      if (q && !searchText(item).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, status, isActive, searchText]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search
              className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label="Search"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="sm:w-40"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <Button onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? emptyTitle : 'No matches'}
          description={
            items.length === 0
              ? emptyDescription
              : 'Try adjusting your search or status filter.'
          }
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-border bg-surface-raised/50 border-b">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className={cn(
                      'text-foreground-muted px-4 py-3 font-medium',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                <th className="text-foreground-muted px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={getKey(item)}
                  className="border-border hover:bg-surface-raised/30 border-b last:border-0"
                >
                  {columns.map((col) => (
                    <td
                      key={col.header}
                      className={cn('text-foreground px-4 py-3', col.className)}
                    >
                      {col.cell(item)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {renderActions(item)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
