'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribe to Supabase Realtime `postgres_changes` on the given tables and
 * refresh the current server-rendered route when any of them changes — debounced
 * so a burst of edits triggers one refresh. RLS scopes which rows the channel
 * delivers to the facility, and that check runs against the *socket's* JWT — so
 * we explicitly hand the user's access token to Realtime before subscribing,
 * otherwise an unauthenticated socket receives no RLS-protected rows and the
 * board only ever updates on the fallback poll. A short interval is a backstop
 * in case a realtime event is missed. Shared by TV Mode and Live Operations.
 */
const FALLBACK_POLL_MS = 30_000;
const DEBOUNCE_MS = 400;

export function useRealtimeRefresh(
  channelKey: string,
  tables: readonly string[],
): void {
  const router = useRouter();
  // Stable identity for the dependency array regardless of array literal churn.
  const tableKey = tables.join(',');

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    // Create the channel and register the table callbacks *synchronously* —
    // `.on('postgres_changes')` must run before `subscribe()`, and a synchronous
    // channel reference guarantees cleanup always removes it (so a remounting
    // effect, e.g. React StrictMode in dev, never reuses a subscribed channel).
    const channel = supabase.channel(`rt-${channelKey}`);
    for (const table of tableKey.split(',')) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        refresh,
      );
    }

    void (async () => {
      // Authenticate the Realtime socket so RLS lets postgres_changes through,
      // then join. If the effect was already torn down, don't subscribe.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (cancelled) return;
      channel.subscribe();
    })();

    const poll = setInterval(() => router.refresh(), FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [router, channelKey, tableKey]);
}
