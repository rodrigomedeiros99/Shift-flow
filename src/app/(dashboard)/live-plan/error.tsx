'use client';

import { useEffect } from 'react';
import { Button, ErrorState } from '@/components/ui';

export default function LivePlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Live-plan route error:', error);
  }, [error]);

  return (
    <ErrorState
      title="Unable to load live plan"
      description="An unexpected error occurred. You can retry, and we'll keep the details in our logs."
      action={
        <Button variant="primary" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
