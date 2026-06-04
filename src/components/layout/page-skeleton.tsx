import { Skeleton } from '@/components/ui';

/**
 * Page-shaped loading placeholder (Phase 10): a title bar plus a grid of card
 * skeletons. Used by route `loading.tsx` files in place of a bare spinner so
 * navigation feels instant and the layout doesn't jump.
 */
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
