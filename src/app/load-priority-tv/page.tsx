import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/queries';
import { listShiftKeys } from '@/features/config/queries';
import { getTvBoard } from '@/features/load-priority/queries';
import { LpTvScreen } from '@/components/load-priority/lp-tv-screen';

export default async function LoadPriorityTvPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const [tv, shiftKeys] = await Promise.all([getTvBoard(), listShiftKeys()]);
  const shiftKeyName = tv
    ? (shiftKeys.find((k) => k.id === tv.board.shiftKeyId)?.name ?? '')
    : '';

  return (
    <LpTvScreen
      board={tv?.board ?? null}
      entries={tv?.entries ?? []}
      shiftKeyName={shiftKeyName}
    />
  );
}
