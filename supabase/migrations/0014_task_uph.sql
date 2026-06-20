-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0014
-- v2.2: per-task UPH (Units Per Hour) for the labor calculator.
--
-- Every task can carry its own productivity rate, used in Create Plan to
-- recommend headcount: people = CEIL(units / (uph * shift_hours)). The rate is
-- configurable in Settings, never hardcoded. `uses_uph` defaults true so all
-- existing active tasks opt in; `avg_units_per_hour` stays NULL until a
-- supervisor sets the real value ("Not configured" until then — no fake seeds).
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

alter table public.task_types
  add column if not exists uses_uph boolean not null default true;

alter table public.task_types
  add column if not exists avg_units_per_hour numeric
    check (avg_units_per_hour is null or avg_units_per_hour > 0);
