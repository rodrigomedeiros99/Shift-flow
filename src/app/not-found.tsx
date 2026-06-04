import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Brand } from '@/components/layout/brand';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="The page you're looking for doesn't exist or hasn't been built yet."
        />
        <div className="mt-4 flex justify-center">
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
