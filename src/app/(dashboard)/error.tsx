'use client';

import { useEffect } from 'react';
import { Button, ErrorState } from '@/components/ui';

export default function DashboardSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Section error:', error);
  }, [error]);

  return (
    <ErrorState
      action={
        <Button variant="primary" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
