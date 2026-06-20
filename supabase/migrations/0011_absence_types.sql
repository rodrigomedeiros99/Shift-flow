-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0011
-- v2.1: absence types — Vacation & Scheduled Time Off alongside Call-offs.
--
-- The `call_offs` table now records any reason an associate is unavailable for
-- planning. A `type` column distinguishes them; all three remove the associate
-- from the available pool identically (auto-generate already excludes everyone
-- in call_offs). The unique(daily_plan_id, associate_id) constraint stays, so an
-- associate has exactly one absence type per plan.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

alter table public.call_offs
  add column if not exists type text not null default 'call_off'
    check (type in ('call_off', 'vacation', 'scheduled_time_off'));
