-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0008
-- Live Operations (Steps 9–10): activity history for in-day labor movement.
--
-- During the shift, leaders move/switch/add/remove associates and complete
-- trailers on a PUBLISHED plan. Those changes mutate the live `assignments`
-- rows (Phase 5) and are recorded here in `activity_history` — "what actually
-- happened" — which is kept SEPARATE from `planned_assignment_history`
-- (leadership intent, frozen at publish; PRD §4.1). Fair rotation keeps using
-- planned history, never this table.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- activity_history — one row per live change (Database Schema Part 2).
-- ---------------------------------------------------------------------------
create table if not exists public.activity_history (
  id                uuid primary key default gen_random_uuid(),
  daily_plan_id     uuid not null references public.daily_plans (id) on delete cascade,
  associate_id      uuid not null references public.associates (id) on delete restrict,
  from_task_type_id uuid references public.task_types (id) on delete set null,
  to_task_type_id   uuid references public.task_types (id) on delete set null,
  from_equipment_id uuid references public.equipment_types (id) on delete set null,
  to_equipment_id   uuid references public.equipment_types (id) on delete set null,
  from_dock_door_id uuid references public.dock_doors (id) on delete set null,
  to_dock_door_id   uuid references public.dock_doors (id) on delete set null,
  action_type       text not null
                      check (action_type in ('assigned', 'moved', 'switched',
                                             'removed', 'completed', 'status_changed')),
  reason            text,
  changed_by        uuid references public.profiles (id) on delete set null,
  changed_at        timestamptz not null default now()
);

create index if not exists activity_history_associate_idx
  on public.activity_history (associate_id, changed_at);
create index if not exists activity_history_plan_idx
  on public.activity_history (daily_plan_id);

-- ---------------------------------------------------------------------------
-- RLS: read = any authenticated facility user; write = planners (auth_can_plan).
-- Facility scoped via EXISTS on the parent daily_plan (pattern from 0005).
-- ---------------------------------------------------------------------------
alter table public.activity_history enable row level security;

drop policy if exists activity_history_select on public.activity_history;
create policy activity_history_select on public.activity_history
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists activity_history_manage on public.activity_history;
create policy activity_history_manage on public.activity_history
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

-- ---------------------------------------------------------------------------
-- Realtime: publish activity_history so the live board + TV update live.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_history'
  ) then
    alter publication supabase_realtime add table public.activity_history;
  end if;
end $$;
