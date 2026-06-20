-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0012
-- v2.1: per-plan dock door equipment.
--
-- Dock doors change daily: the same door may need a Clamp today and a Pacer
-- tomorrow. Equipment is therefore chosen *per plan*, not tied permanently to
-- the door. This adds an optional equipment_id to plan_dock_doors that the
-- leader sets when marking a door active; auto-generate uses it as the unload
-- slot's equipment (still only a suggestion — never required).
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

alter table public.plan_dock_doors
  add column if not exists equipment_id uuid
    references public.equipment_types (id) on delete set null;
