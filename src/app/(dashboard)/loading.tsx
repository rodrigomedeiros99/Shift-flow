import { Spinner } from '@/components/ui';

export default function DashboardSectionLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner label="Loading" />
    </div>
  );
}
