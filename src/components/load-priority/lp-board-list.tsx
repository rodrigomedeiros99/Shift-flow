'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  useToast,
} from '@/components/ui';
import { deleteBoard } from '@/features/load-priority/actions';
import { formatDateUS } from '@/lib/utils/date';
import type { LoadPriorityBoard, LoadPriorityStatus } from '@/types/domain';

const STATUS_TONE: Record<
  LoadPriorityStatus,
  'neutral' | 'success' | 'warning'
> = {
  draft: 'warning',
  published: 'success',
  closed: 'neutral',
};

/**
 * Recent Load Priority boards with Open + Delete. Deleting shows a confirmation —
 * a stronger, destructive one for published boards — then hard-deletes (entries
 * cascade) and refreshes. Only rendered on the planner-gated management page.
 */
export function LpBoardList({
  boards,
  keyName,
}: {
  boards: LoadPriorityBoard[];
  keyName: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<LoadPriorityBoard | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    const wasPublished = deleting.status === 'published';
    setPending(true);
    const result = await deleteBoard(deleting.id);
    setPending(false);
    if (result.ok) {
      toast({
        title: wasPublished
          ? 'Published board deleted successfully.'
          : 'Draft board deleted successfully.',
      });
      setDeleting(null);
      router.refresh();
    } else {
      toast({
        title: 'Could not delete',
        description: result.error,
        variant: 'error',
      });
    }
  }

  if (boards.length === 0) {
    return (
      <EmptyState
        title="No boards yet"
        description="Create a board above to pre-fill today's doors from your configuration."
      />
    );
  }

  const published = deleting?.status === 'published';

  return (
    <>
      <ul className="divide-border divide-y">
        {boards.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-foreground font-medium">
                {formatDateUS(b.boardDate)}
              </span>
              <span className="text-foreground-muted text-sm">
                {keyName[b.shiftKeyId] ?? '—'}
              </span>
              <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href={`/load-priority/${b.id}`}>
                <Button size="sm" variant="secondary">
                  Open
                </Button>
              </Link>
              <IconButton
                label="Delete board"
                tone="danger"
                onClick={() => setDeleting(b)}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              />
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!deleting}
        title={published ? 'Delete Published Board?' : 'Delete Draft Board?'}
        description={
          published
            ? 'This board has already been published. Deleting it will remove it from management history and the TV view. Are you sure you want to continue?'
            : 'Are you sure you want to delete this draft Load Priority Board? This action cannot be undone.'
        }
        confirmLabel={published ? 'Delete Published Board' : 'Delete Draft'}
        destructive={published}
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
