'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  /** 1-based index of the first row shown, and of the last. */
  start: number;
  end: number;
}

/** Windowed page numbers around the current page (with first/last anchors). */
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i += 1) out.push(i);
  if (to < totalPages - 1) out.push('…');
  out.push(totalPages);
  return out;
}

/** Prev / numbered pages / Next for the detailed history table. */
export function HistoryPagination({
  page,
  totalPages,
  total,
  start,
  end,
}: HistoryPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p <= 1) params.delete('page');
      else params.set('page', String(p));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const btn =
    'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-foreground-muted text-sm">
        {total === 0
          ? 'No records'
          : `Showing ${start}–${end} of ${total} records`}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(btn, 'hover:bg-surface-raised gap-1')}
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span
              key={`gap-${i}`}
              className="text-foreground-subtle px-1 text-sm"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                btn,
                p === page
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-surface-raised',
              )}
              onClick={() => goTo(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={cn(btn, 'hover:bg-surface-raised gap-1')}
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
