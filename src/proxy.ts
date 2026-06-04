import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16 Proxy (formerly Middleware). Runs on every matched request to
 * refresh the Supabase session and apply optimistic auth redirects.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Run on all routes except Next.js internals and static assets, so session
   * refresh + route protection apply to every page and API route.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
