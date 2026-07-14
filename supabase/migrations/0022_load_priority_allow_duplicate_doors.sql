-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0022
-- Load Priority: allow duplicate dock doors.
--
-- A door can legitimately appear more than once (e.g. two trailers loading at
-- DD708 the same day / on the same weekday). Drop the unique constraints that
-- blocked this on both the daily entries and the weekly master. The app's
-- upsert-by-door flows are reworked to plain inserts / explicit updates.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

do $$
declare
  c record;
begin
  for c in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and con.contype = 'u'
      and rel.relname in (
        'load_priority_entries',
        'load_priority_weekly_schedules'
      )
  loop
    execute format(
      'alter table public.%I drop constraint %I',
      c.relname,
      c.conname
    );
  end loop;
end $$;
