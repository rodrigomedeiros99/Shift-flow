-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0009
-- Phase 10 (Production Hardening): audit logging.
--
-- Append-only record of important actions (create/publish/close a plan, live
-- moves & switches, …) for accountability and review (Database Schema Part 3).
-- Separate from activity_history (operational labor movement) and
-- planned_assignment_history (leadership intent).
--
-- Reads are restricted to managers (admin/supervisor); any authenticated user
-- in the facility may insert their own audit rows (so actions can log as the
-- acting user). No updates or deletes — the trail is immutable.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  daily_plan_id uuid references public.daily_plans (id) on delete set null,
  action_type   text not null,
  entity_type   text,
  entity_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_logs_facility_created_idx
  on public.audit_logs (facility_id, created_at desc);
create index if not exists audit_logs_user_created_idx
  on public.audit_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security.
--   select = managers (admin/supervisor) in the facility
--   insert = any authenticated user in the facility (logs their own actions)
--   update/delete = nobody (append-only trail)
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    facility_id = public.auth_user_facility() and public.auth_is_manager()
  );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (facility_id = public.auth_user_facility());
