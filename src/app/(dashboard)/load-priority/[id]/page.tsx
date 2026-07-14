import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MonitorPlay } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui';
import { PLANNER_ROLES, requireRole } from '@/features/auth/queries';
import { listShiftKeys } from '@/features/config/queries';
import { getBoard, listEntries } from '@/features/load-priority/queries';
import { LpBoardEditor } from '@/components/load-priority/lp-board-editor';
import { formatDateUS } from '@/lib/utils/date';

export default async function LoadPriorityBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(PLANNER_ROLES);
  const { id } = await params;

  const board = await getBoard(id);
  if (!board) notFound();

  const [entries, shiftKeys] = await Promise.all([
    listEntries(id),
    listShiftKeys(),
  ]);
  const shiftKeyName =
    shiftKeys.find((k) => k.id === board.shiftKeyId)?.name ?? '';

  return (
    <>
      {/* Direct route back (not browser history) so it works from a saved link. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/load-priority">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Load Priority
          </Button>
        </Link>
        <Link href="/load-priority-tv" target="_blank">
          <Button variant="secondary" size="sm" className="gap-2">
            <MonitorPlay className="h-4 w-4" aria-hidden="true" />
            Open TV view
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Load Priority board"
        description={`${shiftKeyName} · ${formatDateUS(board.boardDate)}`}
      />
      <LpBoardEditor board={board} entries={entries} />
    </>
  );
}
