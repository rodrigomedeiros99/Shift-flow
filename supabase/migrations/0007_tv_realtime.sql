-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0007
-- Phase 8: TV Mode — enable Supabase Realtime on the published-plan board tables.
--
-- TV Mode subscribes to postgres_changes on just these tables (not globally) so
-- the display updates within seconds without a manual refresh. Existing RLS
-- select policies already scope rows to the caller's facility, which also
-- governs what Realtime delivers, so no policy changes are needed.
--
-- No new tables. The announcement banner + table are deferred to a later pass.
--
-- Apply via Supabase Dashboard → SQL Editor (Realtime must be enabled for the
-- project). Idempotent — safe to re-run.
-- ============================================================================

do $$
declare
  tbl text;
  board_tables text[] := array[
    'daily_plans',
    'assignments',
    'special_assignments',
    'plan_dock_doors'
  ];
begin
  foreach tbl in array board_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    end if;
  end loop;
end $$;
