-- ============================================================================
-- ShiftFlow DFC 5523 — Migration 0005
-- Phase 5: Outbound planning (create → publish) with RLS.
--
-- Adds daily_plans, call_offs, special_assignments, assignments, and
-- planned_assignment_history. These tables are shared with inbound planning
-- (Phase 6); this phase exercises them for outbound.
--
-- Live in-day operations (activity_history, assignment_switches) and shift
-- close land in the later /live-plan phase and are intentionally NOT created
-- here (no placeholder tables).
--
-- Write access = planners (auth_can_plan: admin, supervisor, inbound_leader,
-- outbound_leader), reusing the helper from migration 0004.
--
-- Apply via Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- daily_plans — the plan header. One active (draft/published) plan per
-- facility + department + key + date (Database Schema Part 2).
-- ---------------------------------------------------------------------------
create table if not exists public.daily_plans (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete restrict,
  shift_key_id  uuid not null references public.shift_keys (id) on delete restrict,
  plan_date     date not null,
  version       integer not null default 1,
  status        text not null default 'draft'
                  check (status in ('draft', 'published', 'closed', 'archived')),
  -- Who owns Middle Mile for this shift (PRD §5). null = not yet decided.
  middle_mile_owner text check (middle_mile_owner in ('outbound', 'inbound')),
  created_by    uuid references public.profiles (id) on delete set null,
  published_at  timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- Only one active plan per facility/department/key/date (duplicate warning).
create unique index if not exists daily_plans_active_uniq
  on public.daily_plans (facility_id, department_id, shift_key_id, plan_date)
  where status in ('draft', 'published');

create index if not exists daily_plans_facility_date_idx
  on public.daily_plans (facility_id, plan_date);

-- ---------------------------------------------------------------------------
-- call_offs — associates unavailable for the day's planning.
-- ---------------------------------------------------------------------------
create table if not exists public.call_offs (
  id            uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_plans (id) on delete cascade,
  associate_id  uuid not null references public.associates (id) on delete restrict,
  reason        text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (daily_plan_id, associate_id)
);

create index if not exists call_offs_plan_idx
  on public.call_offs (daily_plan_id);

-- ---------------------------------------------------------------------------
-- special_assignments — morning-wizard exceptions (OT, Middle Mile, ICQA,
-- training pairs, support).
-- ---------------------------------------------------------------------------
create table if not exists public.special_assignments (
  id                   uuid primary key default gen_random_uuid(),
  daily_plan_id        uuid not null references public.daily_plans (id) on delete cascade,
  associate_id         uuid not null references public.associates (id) on delete restrict,
  type                 text not null
                         check (type in ('overtime', 'middle_mile', 'icqa_support',
                                         'training', 'support_outbound')),
  task_type_id         uuid references public.task_types (id) on delete set null,
  equipment_id         uuid references public.equipment_types (id) on delete set null,
  dock_door_id         uuid references public.dock_doors (id) on delete set null,
  related_associate_id uuid references public.associates (id) on delete set null,
  notes                text,
  created_at           timestamptz not null default now()
);

create index if not exists special_assignments_plan_idx
  on public.special_assignments (daily_plan_id);

-- ---------------------------------------------------------------------------
-- assignments — the current/live state of a plan (also the draft board).
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  daily_plan_id      uuid not null references public.daily_plans (id) on delete cascade,
  associate_id       uuid not null references public.associates (id) on delete restrict,
  task_type_id       uuid references public.task_types (id) on delete set null,
  equipment_id       uuid references public.equipment_types (id) on delete set null,
  dock_door_id       uuid references public.dock_doors (id) on delete set null,
  assignment_type    text not null default 'planned'
                       check (assignment_type in ('planned', 'overtime', 'training',
                                                  'support', 'housekeeping')),
  status             text not null default 'assigned'
                       check (status in ('assigned', 'active', 'available', 'break',
                                         'lunch', 'training', 'overtime', 'completed')),
  notes              text,
  is_primary_planned boolean not null default true,
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists assignments_plan_idx
  on public.assignments (daily_plan_id);

-- ---------------------------------------------------------------------------
-- planned_assignment_history — the official published plan, immutable. Used
-- by the Fair Rotation Engine (Phase 7).
-- ---------------------------------------------------------------------------
create table if not exists public.planned_assignment_history (
  id            uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_plans (id) on delete cascade,
  associate_id  uuid not null references public.associates (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  shift_key_id  uuid not null references public.shift_keys (id) on delete restrict,
  task_type_id  uuid references public.task_types (id) on delete set null,
  equipment_id  uuid references public.equipment_types (id) on delete set null,
  dock_door_id  uuid references public.dock_doors (id) on delete set null,
  plan_date     date not null,
  created_at    timestamptz not null default now()
);

create index if not exists planned_history_associate_date_idx
  on public.planned_assignment_history (associate_id, plan_date);
create index if not exists planned_history_dept_key_date_idx
  on public.planned_assignment_history (department_id, shift_key_id, plan_date);

-- ---------------------------------------------------------------------------
-- Row Level Security.
--   read  = any authenticated user in the facility
--   write = planners (auth_can_plan) in the facility
-- Child tables scope facility via an EXISTS on the parent daily_plan.
-- ---------------------------------------------------------------------------
alter table public.daily_plans                enable row level security;
alter table public.call_offs                  enable row level security;
alter table public.special_assignments        enable row level security;
alter table public.assignments                enable row level security;
alter table public.planned_assignment_history enable row level security;

-- daily_plans
drop policy if exists daily_plans_select on public.daily_plans;
create policy daily_plans_select on public.daily_plans
  for select to authenticated
  using (facility_id = public.auth_user_facility());

drop policy if exists daily_plans_manage on public.daily_plans;
create policy daily_plans_manage on public.daily_plans
  for all to authenticated
  using (facility_id = public.auth_user_facility() and public.auth_can_plan())
  with check (facility_id = public.auth_user_facility() and public.auth_can_plan());

-- Helper predicate (inlined per table): the parent plan is in my facility.
-- call_offs
drop policy if exists call_offs_select on public.call_offs;
create policy call_offs_select on public.call_offs
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists call_offs_manage on public.call_offs;
create policy call_offs_manage on public.call_offs
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

-- special_assignments
drop policy if exists special_assignments_select on public.special_assignments;
create policy special_assignments_select on public.special_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists special_assignments_manage on public.special_assignments;
create policy special_assignments_manage on public.special_assignments
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

-- assignments
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists assignments_manage on public.assignments;
create policy assignments_manage on public.assignments
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

-- planned_assignment_history
drop policy if exists planned_history_select on public.planned_assignment_history;
create policy planned_history_select on public.planned_assignment_history
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_plans p
      where p.id = daily_plan_id and p.facility_id = public.auth_user_facility()
    )
  );

drop policy if exists planned_history_manage on public.planned_assignment_history;
create policy planned_history_manage on public.planned_assignment_history
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
