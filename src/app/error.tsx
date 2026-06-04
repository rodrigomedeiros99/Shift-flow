'use client';

import { useEffect } from 'react';
import { Button, ErrorState } from '@/components/ui';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <ErrorState
          action={
            <Button variant="primary" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </div>
    </div>
  );
}
