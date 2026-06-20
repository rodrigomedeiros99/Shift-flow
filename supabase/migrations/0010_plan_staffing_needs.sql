-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0010
-- v2: staffing-needs-driven planning (replaces templates as the plan input).
--
-- A plan now begins with "how many people per task" instead of a template.
-- These rows are the supervisor's stated demand; auto-generate expands them
-- (plus, for inbound, the active dock doors) into assignment slots and fills
-- them with available associates respecting certifications and fair rotation.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.plan_staffing_needs (
  id            uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_plans (id) on delete cascade,
  task_type_id  uuid not null references public.task_types (id) on delete restrict,
  people_needed integer not null default 0 check (people_needed >= 0),
  created_at    timestamptz not null default now(),
  unique (daily_plan_id, task_type_id)
);

create index if not exists plan_staffing_needs_plan_idx
  on public.plan_staffing_needs (daily_plan_id);

-- ---------------------------------------------------------------------------
-- RLS: read = any authenticated facility user; write = planners
-- (auth_can_plan). Facility scoped via EXISTS on the parent daily_plan
-- (pattern from call_offs in 0005).
-- ---------------------------------------------------------------------------
alter table public.plan_staffing_needs enable row level security;

drop policy if exists plan_staffing_needs_select on public.plan_staffing_needs;
create policy plan_staffing_needs_select on public.plan_staffing_needs
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists plan_staffing_needs_manage on public.plan_staffing_needs;
create policy plan_staffing_needs_manage on public.plan_staffing_needs
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
