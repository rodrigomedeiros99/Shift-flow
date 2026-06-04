import { Spinner } from '@/components/ui';

export default function RootLoading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Spinner label="Loading ShiftFlow" />
    </div>
  );
}
