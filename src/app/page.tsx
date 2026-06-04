import { redirect } from 'next/navigation';

/**
 * Root entry point. Routing to the appropriate landing screen based on auth
 * state is added in Phase 2; for now the foundation lands on the dashboard.
 */
export default function RootPage() {
  redirect('/dashboard');
}
