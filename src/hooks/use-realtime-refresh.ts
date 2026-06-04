'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribe to Supabase Realtime `postgres_changes` on the given tables and
 * refresh the current server-rendered route when any of them changes — debounced
 * so a burst of edits triggers one refresh. RLS scopes which rows the channel
 * delivers to the facility. A slow interval is a fallback only, in case a
 * realtime event is missed. Shared by TV Mode and Live Operations.
 */
const FALLBACK_POLL_MS = 45_000;
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

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    const channel = supabase.channel(`rt-${channelKey}`);
    for (const table of tableKey.split(',')) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        refresh,
      );
    }
    channel.subscribe();

    const poll = setInterval(() => router.refresh(), FALLBACK_POLL_MS);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [router, channelKey, tableKey]);
}
