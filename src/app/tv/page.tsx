import { redirect } from 'next/navigation';
import { TvScreen } from '@/components/tv/tv-screen';
import { getCurrentProfile } from '@/features/auth/queries';
import { getTvBoard } from '@/features/tv/queries';

export const metadata = { title: 'TV Mode' };

export default async function TvPage() {
  const [profile, board] = await Promise.all([
    getCurrentProfile(),
    getTvBoard(),
  ]);
  if (!profile) redirect('/login');

  return <TvScreen board={board} facilityId={profile.facilityId} />;
}
