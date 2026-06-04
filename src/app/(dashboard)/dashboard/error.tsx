'use client';

import { useEffect } from 'react';
import { Button, ErrorState } from '@/components/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log technical details for server-side observability; never shown to users (§3).
    console.error('Dashboard route error:', error);
  }, [error]);

  return (
    <ErrorState
      title="Unable to load the dashboard"
      description="An unexpected error occurred. You can retry, and we'll keep the details in our logs."
      action={
        <Button variant="primary" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
