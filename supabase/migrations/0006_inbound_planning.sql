-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0006
-- Phase 6: Inbound planning (create → publish).
--
-- Inbound reuses the planning tables from migration 0005. This migration adds
-- only what the inbound flow needs on top:
--   1. departments.kind  — classifies a department as inbound/outbound/support/
--      other so the planning workspace can render the right flow without
--      hardcoding department names.
--   2. template_items.per_active_door — a generic flag: when set, the item
--      expands to one slot per *active* dock door at generation time (the
--      inbound "Unload per door" row). Defaults false, so outbound is untouched.
--   3. plan_dock_doors — which doors a leader marked active for a given plan
--      (Step 4 of the inbound wizard). Drives inbound auto-generate.
--
-- Live in-day operations (trailer completion, live reassignment,
-- activity_history) and shift close remain deferred to the later Live
-- Operations phase — no placeholder tables here.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. departments.kind — operational classification of a department.
--    Backfilled for the migration 0002 seed rows by name; the column is the
--    source of truth thereafter (editable in Settings → Departments).
-- ---------------------------------------------------------------------------
alter table public.departments
  add column if not exists kind text not null default 'other'
    check (kind in ('inbound', 'outbound', 'support', 'other'));

update public.departments set kind = 'inbound'  where lower(name) = 'inbound'  and kind = 'other';
update public.departments set kind = 'outbound' where lower(name) = 'outbound' and kind = 'other';
update public.departments set kind = 'support'  where lower(name) = 'support'  and kind = 'other';

-- ---------------------------------------------------------------------------
-- 2. template_items.per_active_door — expand this item across the plan's
--    active dock doors during inbound auto-generate (one slot per door).
-- ---------------------------------------------------------------------------
alter table public.template_items
  add column if not exists per_active_door boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. plan_dock_doors — doors the leader selected as active for a plan today.
-- ---------------------------------------------------------------------------
create table if not exists public.plan_dock_doors (
  id            uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_plans (id) on delete cascade,
  dock_door_id  uuid not null references public.dock_doors (id) on delete restrict,
  created_at    timestamptz not null default now(),
  unique (daily_plan_id, dock_door_id)
);

create index if not exists plan_dock_doors_plan_idx
  on public.plan_dock_doors (daily_plan_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: read = any authenticated user in the facility;
-- write = planners (auth_can_plan). Facility scoped via EXISTS on the parent
-- daily_plan (same pattern as call_offs / assignments in migration 0005).
-- ---------------------------------------------------------------------------
alter table public.plan_dock_doors enable row level security;

drop policy if exists plan_dock_doors_select on public.plan_dock_doors;
create policy plan_dock_doors_select on public.plan_dock_doors
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists plan_dock_doors_manage on public.plan_dock_doors;
create policy plan_dock_doors_manage on public.plan_dock_doors
  for all to authenticated
  using (
    public.auth_can_plan()
    and exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  )
  with check (
    public.auth_can_plan()
    and exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );
