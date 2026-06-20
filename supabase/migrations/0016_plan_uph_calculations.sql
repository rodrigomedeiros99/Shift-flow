-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0016
-- v2.2: UPH calculation snapshots per plan.
--
-- The UPH calculator is a recommendation tool; it does NOT replace manual
-- staffing needs (those stay in plan_staffing_needs). This table preserves what
-- the calculator showed when the plan was made — units entered, the UPH and
-- shift hours used at that moment, the recommended headcount, and the final
-- number the supervisor chose — so old plans keep their original UPH even after
-- Settings change. One row per task per plan.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.plan_uph_calculations (
  id                 uuid primary key default gen_random_uuid(),
  daily_plan_id      uuid not null references public.daily_plans (id) on delete cascade,
  task_type_id       uuid not null references public.task_types (id) on delete restrict,
  units_planned      integer not null default 0 check (units_planned >= 0),
  uph_used           numeric check (uph_used is null or uph_used > 0),
  shift_hours_used   numeric check (shift_hours_used is null or shift_hours_used > 0),
  recommended_people integer check (recommended_people is null or recommended_people >= 0),
  final_people       integer not null default 0 check (final_people >= 0),
  created_at         timestamptz not null default now(),
  unique (daily_plan_id, task_type_id)
);

create index if not exists plan_uph_calculations_plan_idx
  on public.plan_uph_calculations (daily_plan_id);

-- ---------------------------------------------------------------------------
-- RLS: read = any authenticated facility user; write = planners
-- (auth_can_plan). Facility scoped via EXISTS on the parent daily_plan
-- (same pattern as plan_staffing_needs in migration 0010).
-- ---------------------------------------------------------------------------
alter table public.plan_uph_calculations enable row level security;

drop policy if exists plan_uph_calculations_select on public.plan_uph_calculations;
create policy plan_uph_calculations_select on public.plan_uph_calculations
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists plan_uph_calculations_manage on public.plan_uph_calculations;
create policy plan_uph_calculations_manage on public.plan_uph_calculations
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
