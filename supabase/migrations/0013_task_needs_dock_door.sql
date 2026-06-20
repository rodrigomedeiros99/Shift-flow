-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0013
-- v2.1: door-driven inbound tasks.
--
-- Some inbound tasks (e.g. Unload) are staffed *per active dock door* rather
-- than by a people-per-task count: each active door becomes one position with
-- that door's equipment for the day. This flag marks those tasks so generation
-- and the planning UI can branch on it WITHOUT hardcoding task names.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

alter table public.task_types
  add column if not exists needs_dock_door boolean not null default false;
