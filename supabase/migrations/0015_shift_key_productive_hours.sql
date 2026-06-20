-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0015
-- v2.2: productive hours per shift key (UPH calculator shift-hours input).
--
-- The UPH calculator needs the shift's productive hours. shift_keys only stored
-- start/end times, so this adds a configurable `productive_hours` field (kept
-- editable in Settings) and seeds the known keys: Key 1/Key 2 = 10, Key 3 = 12.
-- Other keys stay NULL until configured.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

alter table public.shift_keys
  add column if not exists productive_hours numeric
    check (productive_hours is null or productive_hours > 0);

update public.shift_keys set productive_hours = 10
  where productive_hours is null and name in ('Key 1', 'Key 2');
update public.shift_keys set productive_hours = 12
  where productive_hours is null and name = 'Key 3';
